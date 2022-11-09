// eslint-disable-next-line
let aws = require('aws-sdk') // Assume AWS-SDK is installed via Arc
let { toLogicalID } = require('@architect/utils')
let { updater } = require('@architect/utils')
let getMultiRegionOptions = require('./_get-multi-region-options')
let getArcOptions = require('./_get-arc-options')

module.exports = async (arc, stage, dryRun) => {
  const { primaryRegion, bucketNames } = getMultiRegionOptions(arc)
  const { appName, currentRegion } = getArcOptions(arc)

  const update = updater('MultiRegion')
  update.start(`Fetching buckets in (${currentRegion})...`)

  let ssmPrimary = new aws.SSM({ region: primaryRegion })

  let buckets = []
  for (let privacy of [ 'private', 'public' ]) {
    for (let bucketName of bucketNames[privacy]) {
      let PhysicalBucketName // aka the physical table name
      try {
        // Arc app physical table names are stored in SSM service discovery
        let Name = `/${toLogicalID(appName)}${toLogicalID(stage)}/storage-${privacy}/${bucketName}`
        let { Parameter } = await ssmPrimary.getParameter({ Name }).promise()
        PhysicalBucketName = Parameter.Value
        buckets.push({
          arn: `arn:aws:s3:::${bucketName}`,
          logicalName: bucketName,
          physicalName: PhysicalBucketName,
          privacy: privacy
        })
      }
      catch (err) {
        if (err.name === 'ParameterNotFound') {
          const message = `${bucketName} not found on ${currentRegion}`
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
  }

  update.done(`Buckets fetched (${currentRegion})`)

  update.status(`Fetched buckets in (${currentRegion})`, buckets.map((bucket) => {
    return `${bucket.privacy} ${bucket.privacy == 'public' ? '...' : '..'} ${bucket.logicalName}`
  }))

  return buckets
}
