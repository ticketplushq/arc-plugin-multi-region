// eslint-disable-next-line
let aws = require('aws-sdk') // Assume AWS-SDK is installed via Arc
let { toLogicalID } = require('@architect/utils')

module.exports = {
  deploy: {
    start: async ({ arc, cloudformation, stage }) => {
      const multiRegion = arc['arc-plugin-multi-region']
      if (!multiRegion) return cloudformation

      const appName = arc.app[0]
      const primaryRegion = multiRegion[0][1]
      const replicaRegions = multiRegion[1].replicas

      let currentRegion
      arc.aws.forEach((element) => {
        if (element[0] == 'region') {
          currentRegion = element[1]
        }
      })

      if (primaryRegion == currentRegion) {
        return
      }

      if (!replicaRegions.includes(currentRegion)) {
        throw Error(`The following region is not included in replica regions: ${currentRegion}`)
      }

      let dynamoReplica = new aws.DynamoDB()
      let ssmPrimary = new aws.SSM({ region: primaryRegion })

      let tableNames = []
      arc.tables.forEach((table) => {
        tableNames = tableNames.concat(Object.keys(table))
      })

      let tables = []
      for (let tableName of tableNames) {
        let TableName // aka the physical table name
        try {
          // Arc app physical names are stored in SSM service discovery
          let Name = `/${toLogicalID(appName)}${toLogicalID(stage)}/tables/${tableName}`
          let { Parameter } = await ssmPrimary.getParameter({ Name }).promise()
          TableName = Parameter.Value

          let { Table } = await dynamoReplica.describeTable({ TableName }).promise()
          tables.push({
            arn: Table.TableArn,
            logicalName: tableName,
            physicalName: TableName,
          })
        }
        catch (err) {
          if (err.name === 'ParameterNotFound') {
            throw ReferenceError(`${tableName} not found on replica ${currentRegion}`)
          }
          if (err.name === 'ResourceNotFoundException') {
            throw ReferenceError(`DynamoDB table not found: ${TableName}`)
          }
          throw (err)
        }
      }

      let index = cloudformation.Resources.Role.Properties.Policies
        .findIndex(item => item.PolicyName === 'ArcDynamoPolicy')
      tables.forEach(({ arn, logicalName, physicalName }) => {
        // Cleanup previous DynamoDB Policies
        cloudformation.Resources.Role.Properties
          .Policies[index].PolicyDocument.Statement[0].Resource = []
        // Add new DynamoDB Policies
        cloudformation.Resources.Role.Properties
          .Policies[index].PolicyDocument.Statement[0].Resource.push(
            arn,
            `${arn}/*`,
            `${arn}/stream/*`,
          )
        // Remove the default table and param generate by Architect
        let originalResourceParamName = `${toLogicalID(logicalName)}Param`
        delete cloudformation.Resources[originalResourceParamName]
        let originalResourceTableName = `${toLogicalID(logicalName)}Table`
        delete cloudformation.Resources[originalResourceTableName]
        // Create a custom global table param
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
  },
}
