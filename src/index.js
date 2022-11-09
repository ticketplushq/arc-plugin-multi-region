const { toLogicalID } = require('@architect/utils')
let getMultiRegionOptions = require('./_get-multi-region-options')
let getArcOptions = require('./_get-arc-options')
let updateReplication = require('./_update_replication')
let getReplicatedTables = require('./_get-replicated-tables')
let getBuckets = require('./_get-buckets')

module.exports = {
  deploy: {
    start: async ({ arc, cloudformation, stage, dryRun }) => {
      const cfn = cloudformation
      const multiRegion = arc['multi-region']
      if (!multiRegion) return cfn

      const { primaryRegion, replicaRegions } = getMultiRegionOptions(arc)
      const { currentRegion } = getArcOptions(arc)

      if (primaryRegion == currentRegion) return

      if (!replicaRegions.includes(currentRegion)) {
        throw Error(`The following region is not included in replica regions: ${currentRegion}`)
      }

      const tables = await getReplicatedTables(arc, stage, dryRun)
      let dynamoPolicyIndex = cfn.Resources.Role.Properties.Policies
        .findIndex(item => item.PolicyName === 'ArcDynamoPolicy')
      let dynamoPolicyDoc = cfn.Resources.Role.Properties.Policies[dynamoPolicyIndex]
        .PolicyDocument.Statement[0]

      tables.forEach(({ arn, logicalName, physicalName }) => {
        const ID = toLogicalID(logicalName)
        // Delete old DynamoDB Tables
        const originalResourceName = `${ID}Table`
        delete cfn.Resources[originalResourceName]
        // Delete old SSM Parameters
        const originalResourceParamName = `${ID}Param`
        delete cfn.Resources[originalResourceParamName]
        // Delete old DynamoDB Policies
        dynamoPolicyDoc.Resource = dynamoPolicyDoc.Resource.filter((resource) => {
          return !resource['Fn::Sub'] || resource['Fn::Sub'][1].tablename.Ref != originalResourceName
        })

        // Add new DynamoDB Policies
        dynamoPolicyDoc.Resource.push(arn, `${arn}/*`, `${arn}/stream/*`)
        // Add new SSM Parameter for Global Table
        let resourceName = `${ID}GlobalTableParam`
        cfn.Resources[resourceName] = {
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

      const buckets = await getBuckets(arc, stage, dryRun)

      buckets.forEach(({ arn, logicalName, physicalName, privacy }) => {
        const bucketPolicyDoc = cfn.Resources[
          `P${privacy.slice(1)}StorageMacroPolicy`
        ].Properties.PolicyDocument.Statement[0]
        const ID = toLogicalID(logicalName)
        // Delete old Bucket
        const originalResourceName = `${ID}Bucket`
        delete cfn.Resources[originalResourceName]
        // Delete old SSM Parameters
        const originalResourceParamName = `${ID}Param`
        delete cfn.Resources[originalResourceParamName]
        // Delete old Bucket Policies
        bucketPolicyDoc.Resource = bucketPolicyDoc.Resource.filter((resource) => {
          return !resource['Fn::Sub'] || resource['Fn::Sub'][1].bucket.Ref != originalResourceName
        })

        // Add IAM policy for least-priv runtime access
        bucketPolicyDoc.Resource.push(arn, `${arn}/*`)
        // Add new SSM Parameter for runtime discovery
        let resourceName = `${ID}BucketParam`
        cfn.Resources[resourceName] = {
          Type: 'AWS::SSM::Parameter',
          Properties: {
            Type: 'String',
            Name: {
              'Fn::Sub': [
                '/${AWS::StackName}/storage-${privacy}/${bucketname}',
                {
                  bucketname: logicalName,
                  privacy
                }
              ]
            },
            Value: physicalName
          }
        }
        // Replace bucket env var on all Lambda functions
        Object.keys(cfn.Resources).forEach((k) => {
          let BUCKET = `ARC_STORAGE_PUBLIC_${logicalName.replace(/-/g, '_').toUpperCase()}`
          if (cfn.Resources[k].Type === 'AWS::Serverless::Function') {
            cfn.Resources[k].Properties.Environment.Variables[BUCKET] = physicalName
          }
        })
      })

      return cfn
    },
    end: async ({ arc, cloudformation, stage, dryRun }) => {
      const multiRegion = arc['multi-region']
      if (!multiRegion) return cloudformation

      const { primaryRegion } = getMultiRegionOptions(arc)
      const { currentRegion } = getArcOptions(arc)

      if (primaryRegion != currentRegion) return

      await updateReplication(arc, stage, dryRun)

      return cloudformation
    }
  },
}
