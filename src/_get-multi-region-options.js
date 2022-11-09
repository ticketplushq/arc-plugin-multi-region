module.exports = (arc) => {
  const multiRegion = arc['multi-region']
  if (!Array.isArray(multiRegion)) {
    throw ReferenceError('Invalid multi region params')
  }

  let primaryRegion
  const primaryRegionIndex = multiRegion.findIndex((param) => Array.isArray(param) && param[0] == 'primary')
  if (primaryRegionIndex >= 0) {
    primaryRegion = multiRegion[primaryRegionIndex][1]
  }
  else {
    throw ReferenceError('Invalid multi region params: Missing primary region')
  }

  let replicaRegions
  const replicasIndex = multiRegion.findIndex((param) => param.replicas)
  if (replicasIndex >= 0 && Array.isArray(multiRegion[replicasIndex].replicas)) {
    replicaRegions = multiRegion[replicasIndex].replicas
  }
  else {
    throw ReferenceError('Invalid multi region params: Missing replica regions')
  }

  let bucketNames = { public: [], private: [] };
  [ 'public', 'private' ].forEach((privacy) => {
    if (arc[`storage-${privacy}`]) {
      bucketNames[privacy] = bucketNames[privacy].concat(arc[`storage-${privacy}`])
    }
  })
  const skipBucketsIndex = multiRegion.findIndex((param) => param['skip-buckets'])
  if (skipBucketsIndex >= 0 && Array.isArray(multiRegion[skipBucketsIndex]['skip-buckets'])) {
    bucketNames.public = bucketNames.public - multiRegion[skipBucketsIndex]['skip-buckets']
    bucketNames.private = bucketNames.private - multiRegion[skipBucketsIndex]['skip-buckets']
  }

  return { primaryRegion, replicaRegions, bucketNames }
}
