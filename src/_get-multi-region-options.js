module.exports = (multiRegion) => {
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

  return { primaryRegion, replicaRegions }
}
