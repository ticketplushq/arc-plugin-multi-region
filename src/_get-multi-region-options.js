module.exports = (multiRegion) => {
  if (!Array.isArray(multiRegion)) {
    throw ReferenceError('Invalid multi region params')
  }

  let primaryRegion
  if (Array.isArray(multiRegion[0]) && multiRegion[0][0] == 'primary') {
    primaryRegion = multiRegion[0][1]
  }
  else {
    throw ReferenceError('Invalid multi region params: Missing primary region')
  }

  let replicaRegions
  if (multiRegion[1] !== undefined && Array.isArray(multiRegion[1].replicas)) {
    replicaRegions = multiRegion[1].replicas
  }
  else {
    throw ReferenceError('Invalid multi region params: Missing replica regions')
  }

  return { primaryRegion, replicaRegions }
}
