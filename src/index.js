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

      buckets.forEach(({ logicalName, physicalName, privacy }) => {
        const bucketPolicyDoc = cfn.Resources[
          `P${privacy.slice(1)}StorageMacroPolicy`
        ].Properties.PolicyDocument.Statement[0]
        const ID = toLogicalID(logicalName)
        const originalResourceName = `${ID}Bucket`

        // Delete old Bucket resource
        delete cfn.Resources[originalResourceName]

        // Delete bucket policy as well (it references the bucket we're deleting)
        if (privacy === 'public') {
          delete cfn.Resources[`${ID}Policy`]
        }

        // Create CloudFormation parameter for cross-region bucket reference
        cfn.Parameters = cfn.Parameters || {}
        cfn.Parameters[originalResourceName] = {
          Type: 'String',
          Default: physicalName,
          Description: `Cross-region reference to bucket ${logicalName}`
        }

        // Delete old SSM Parameters
        const originalResourceParamName = `${ID}Param`
        delete cfn.Resources[originalResourceParamName]

        // Delete old Bucket Policies from IAM
        bucketPolicyDoc.Resource = bucketPolicyDoc.Resource.filter((resource) => {
          return !resource['Fn::Sub'] || resource['Fn::Sub'][1].bucket.Ref != originalResourceName
        })

        // Add IAM policy for least-priv runtime access with dynamic reference
        bucketPolicyDoc.Resource.push(
          { 'Fn::Sub': [ `arn:aws:s3:::$\{${originalResourceName}}`, {} ] },
          { 'Fn::Sub': [ `arn:aws:s3:::$\{${originalResourceName}}/*`, {} ] }
        )

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
            Value: { Ref: originalResourceName }
          }
        }

        // Note: Lambda environment variables already have { Ref: originalResourceName } from storage-public plugin
        // Since we're creating a parameter with the same name, the references will work correctly
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
  set: {
    env: ({ arc }) => {
      const multiRegion = arc['multi-region']
      if (!multiRegion) return { ARC_MULTI_REGION: false }

      const { primaryRegion } = getMultiRegionOptions(arc)
      const { currentRegion } = getArcOptions(arc)

      return {
        ARC_MULTI_REGION_PRIMARY: primaryRegion,
        ARC_MULTI_REGION_CURRENT: currentRegion
      }
    }
  }
}
