let test = require('tape')
let { join } = require('path')
let sut = join(process.cwd(), 'src', '_get-arc-options')
let getArcOptions = require(sut)
let _inventory = require('@architect/inventory')

test('Set up env', (t) => {
  t.plan(1)
  t.ok(getArcOptions, 'arc options getter is present')
})

test('Arc options', async (t) => {
  t.plan(1)
  let rawArc = `
@app
my-app
@aws
profile default
region us-west-1
`
  let correctOptions = {
    appName: 'my-app',
    currentRegion: 'us-west-1'
  }
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let options = getArcOptions(arc)
  t.deepEqual(options, correctOptions, 'Got correct options')
})
