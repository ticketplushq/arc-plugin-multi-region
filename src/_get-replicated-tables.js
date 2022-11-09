// eslint-disable-next-line
let aws = require('aws-sdk') // Assume AWS-SDK is installed via Arc
let { toLogicalID } = require('@architect/utils')
let { updater } = require('@architect/utils')
let getMultiRegionOptions = require('./_get-multi-region-options')
let getArcOptions = require('./_get-arc-options')

module.exports = async (arc, stage, dryRun) => {
  const { primaryRegion } = getMultiRegionOptions(arc)
  const { appName, currentRegion } = getArcOptions(arc)

  const update = updater('MultiRegion')
  update.start(`Fetching replica tables in the replica region (${currentRegion})...`)

  let dynamoReplica = new aws.DynamoDB({ region: currentRegion })
  let ssmPrimary = new aws.SSM({ region: primaryRegion })

  let tableNames = []
  arc.tables.forEach((table) => {
    tableNames = tableNames.concat(Object.keys(table))
  })

  let tables = []
  for (let tableName of tableNames) {
    let PhysicalTableName // aka the physical table name
    try {
      // Arc app physical table names are stored in SSM service discovery
      let Name = `/${toLogicalID(appName)}${toLogicalID(stage)}/tables/${tableName}`
      let { Parameter } = await ssmPrimary.getParameter({ Name }).promise()
      PhysicalTableName = Parameter.Value

      let { Table } = await dynamoReplica.describeTable({ TableName: PhysicalTableName }).promise()
      tables.push({
        arn: Table.TableArn,
        logicalName: tableName,
        physicalName: PhysicalTableName,
      })
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

  update.done(`Replica tables in the replica region (${currentRegion}) fetched`)

  update.status(`Fetched replica tables in the replica region (${currentRegion})`, tableNames)

  return tables
}
