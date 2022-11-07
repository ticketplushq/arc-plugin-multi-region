module.exports = (arc) => {
  let currentRegion
  arc.aws.forEach((element) => {
    if (element[0] == 'region') {
      currentRegion = element[1]
    }
  })

  return {
    appName: arc.app[0],
    currentRegion
  }
}
