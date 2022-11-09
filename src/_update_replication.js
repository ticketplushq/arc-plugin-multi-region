// eslint-disable-next-line
let aws = require('aws-sdk') // Assume AWS-SDK is installed via Arc
let { toLogicalID } = require('@architect/utils')
let { updater } = require('@architect/utils')
let getMultiRegionOptions = require('./_get-multi-region-options')
let getArcOptions = require('./_get-arc-options')

module.exports = async (arc, stage, dryRun) => {
  const { primaryRegion, replicaRegions } = getMultiRegionOptions(arc)
  const { appName, currentRegion } = getArcOptions(arc)

  const update = updater('MultiRegion')
  const start = Date.now()
  const done = () => update.done(`Replication updated in ${(Date.now() - start) / 1000} seconds`)
  update.status(`Updating replication on primary region (${currentRegion})`)

  let dynamoPrimary = new aws.DynamoDB({ region: primaryRegion })
  let ssmPrimary = new aws.SSM({ region: primaryRegion })

  let tableNames = []
  arc.tables.forEach((table) => {
    tableNames = tableNames.concat(Object.keys(table))
  })

  for (let tableName of tableNames) {
    let PhysicalTableName
    try {
      // Arc app physical table names are stored in SSM service discovery
      let Name = `/${toLogicalID(appName)}${toLogicalID(stage)}/tables/${tableName}`
      let { Parameter } = await ssmPrimary.getParameter({ Name }).promise()
      PhysicalTableName = Parameter.Value

      let { Table } = await dynamoPrimary.describeTable({ TableName: PhysicalTableName }).promise()

      let replicateUpdates = []

      replicaRegions.forEach((replicaRegion) => {
        if (!Table.Replicas || Table.Replicas.findIndex((replica) => replica.RegionName == replicaRegion) < 0) {
          replicateUpdates.push({ Create: { RegionName: replicaRegion } })
        }
      })

      if (Table.Replicas) {
        Table.Replicas.forEach((replica) => {
          if (!replicaRegions.includes(replica.RegionName)) {
            replicateUpdates.push({ Delete: { RegionName: replica.RegionName } })
          }
        })
      }

      const createRegions = replicateUpdates.filter((param) => param.Create).map((param) => param.Create.RegionName)
      const deleteRegions = replicateUpdates.filter((param) => param.Delete).map((param) => param.Delete.RegionName)

      update.status(
        `Initializing replication for table ${tableName}`,
        `Creating replication on regions ... ${createRegions.length > 0 ? createRegions.join(',') : '(skipped)'}`,
        `Deleting replication on regions ... ${deleteRegions.length > 0 ? deleteRegions.join(',') : '(skipped)'}`
      )

      update.start(`Replicating table ${tableName}...`)

      if (replicateUpdates.length > 0 && !dryRun) {
        try {
          for (let replicateUpdate of replicateUpdates) {
            await dynamoPrimary.updateTable({
              TableName: PhysicalTableName,
              ReplicaUpdates: [ replicateUpdate ]
            }).promise()

            do { // Wait to avoid errors with busy tables
              await new Promise(r => setTimeout(r, 5000));
              ({ Table } = await dynamoPrimary.describeTable({ TableName: PhysicalTableName }).promise())
            } while (
              !Table.Replicas ||
              Table.Replicas.findIndex((replica) => [ 'CREATING', 'UPDATING', 'DELETING' ].includes(replica.ReplicaStatus)) >= 0
            )
          }
        }
        catch (error) {
          update.error(`While replicate table ${tableName} !`)
          throw (error)
        }
        update.done(`Replication updated for table ${tableName}`)
      }
      else {
        update.done(`Skipping replication update for table ${tableName}`)
      }
    }
    catch (err) {
      if (err.name === 'ParameterNotFound') {
        const message = `${tableName} not found on ${currentRegion}`
        if (dryRun) {
          update.warn(`${message} (Maybe because is a dry-run)`)
        }
        else {
          update.error(message)
          throw (err)
        }
      }
      else if (err.name === 'ResourceNotFoundException') {
        const message = `DynamoDB table not found: ${PhysicalTableName}`
        if (dryRun) {
          update.warn(`${message} (Maybe because is a dry-run)`)
        }
        else {
          update.error(message)
          throw (err)
        }
      }
      else {
        throw (err)
      }
    }
  }

  done()
}
