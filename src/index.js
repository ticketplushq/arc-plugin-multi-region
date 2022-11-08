const { toLogicalID } = require('@architect/utils')
let getMultiRegionOptions = require('./_get-multi-region-options')
let getArcOptions = require('./_get-arc-options')
let updateReplication = require('./_update_replication')
let getReplicatedTables = require('./_get-replicated-tables')

module.exports = {
  deploy: {
    start: async ({ arc, cloudformation, stage, dryRun }) => {
      const multiRegion = arc['multi-region']
      if (!multiRegion) return cloudformation

      const { primaryRegion, replicaRegions } = getMultiRegionOptions(multiRegion)
      const { appName, currentRegion } = getArcOptions(arc)

      if (primaryRegion == currentRegion) return

      if (!replicaRegions.includes(currentRegion)) {
        throw Error(`The following region is not included in replica regions: ${currentRegion}`)
      }

      let tables = await getReplicatedTables(arc, stage, dryRun, appName, primaryRegion, currentRegion)
      let index = cloudformation.Resources.Role.Properties.Policies
        .findIndex(item => item.PolicyName === 'ArcDynamoPolicy')

      // Delete old DynamoDB Policies
      cloudformation.Resources.Role.Properties
        .Policies[index].PolicyDocument.Statement[0].Resource = []

      tables.forEach(({ arn, logicalName, physicalName }) => {
        // Delete old DynamoDB Tables
        let originalResourceTableName = `${toLogicalID(logicalName)}Table`
        delete cloudformation.Resources[originalResourceTableName]
        // Delete old SSM Parameters
        let originalResourceParamName = `${toLogicalID(logicalName)}Param`
        delete cloudformation.Resources[originalResourceParamName]

        // Add new DynamoDB Policies
        cloudformation.Resources.Role.Properties
          .Policies[index].PolicyDocument.Statement[0].Resource.push(
            arn,
            `${arn}/*`,
            `${arn}/stream/*`,
          )
        // Add new SSM Parameter for Global Table
        let resourceName = `${toLogicalID(logicalName)}GlobalTableParam`
        cloudformation.Resources[resourceName] = {
          Type: 'AWS::SSM::Parameter',
          Properties: {
            Type: 'String',
            Name: {
              'Fn::Sub': [
                '/${AWS::StackName}/tables/${tablename}',
                {
                  tablename: logicalName
                }
              ]
            },
            Value: physicalName
          }
        }
      })

      return cloudformation
    },
    end: async ({ arc, cloudformation, stage, dryRun }) => {
      const multiRegion = arc['multi-region']
      if (!multiRegion) return cloudformation

      const { primaryRegion, replicaRegions } = getMultiRegionOptions(multiRegion)
      const { appName, currentRegion } = getArcOptions(arc)

      if (primaryRegion != currentRegion) return

      await updateReplication(
        arc, stage, dryRun, appName, primaryRegion, replicaRegions, currentRegion
      )

      return cloudformation
    }
  },
}
