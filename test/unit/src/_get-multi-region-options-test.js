let test = require('tape')
let { join } = require('path')
let sut = join(process.cwd(), 'src', '_get-multi-region-options')
let getMultiRegionOptions = require(sut)
let _inventory = require('@architect/inventory')

test('Set up env', (t) => {
  t.plan(1)
  t.ok(getMultiRegionOptions, 'multi-region options getter is present')
})

test('Missing multi-region options', async (t) => {
  t.plan(1)
  let rawArc = `
@app
my-app
@aws
profile default
region us-west-1
@tables
users
  id *String
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  t.throws(() => {
    getMultiRegionOptions(arc)
  }, {
    message: 'Invalid multi region params'
  }, 'multi-region params aren\'t present')
})

test('Missing primary region', async (t) => {
  t.plan(1)
  let rawArc = `
@app
my-app
@aws
profile default
region us-west-1
@tables
users
  id *String
@multi-region
replicas
  us-west-2
  us-east-2
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  t.throws(() => {
    getMultiRegionOptions(arc)
  }, {
    message: 'Invalid multi region params: Missing primary region'
  }, 'primary region param is not present')
})

test('Missing replica regions', async (t) => {
  t.plan(1)
  let rawArc = `
@app
my-app
@aws
profile default
region us-west-1
@tables
users
  id *String
@multi-region
primary us-west-1
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  t.throws(() => {
    getMultiRegionOptions(arc)
  }, {
    message: 'Invalid multi region params: Missing replica regions'
  }, 'replica regions param is not present')
})

test('Buckets from public-storage', async (t) => {
  t.plan(1)
  let rawArc = `
@app
my-app
@aws
profile default
region us-west-1
@tables
users
  id *String
@storage-public
public-data
@multi-region
primary us-west-1
replicas
  us-west-2
  us-east-2
`
  let correctOptions = {
    primaryRegion: 'us-west-1',
    replicaRegions: [ 'us-west-2', 'us-east-2' ],
    bucketNames: { public: [ 'public-data' ], private: [] },
    skipTables: []
  }
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let options = getMultiRegionOptions(arc)
  t.deepEqual(options, correctOptions, 'Got correct options')
})

test('Skipping buckets from public-storage', async (t) => {
  t.plan(1)
  let rawArc = `
@app
my-app
@aws
profile default
region us-west-1
@tables
users
  id *String
@storage-public
public-data
other-public-data
@multi-region
primary us-west-1
replicas
  us-west-2
  us-east-2
skip-buckets
  public-data
`
  let correctOptions = {
    primaryRegion: 'us-west-1',
    replicaRegions: [ 'us-west-2', 'us-east-2' ],
    bucketNames: { public: [ 'other-public-data' ], private: [] },
    skipTables: []
  }
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let options = getMultiRegionOptions(arc)
  t.deepEqual(options, correctOptions, 'Got correct options')
})

test('Buckets from private-storage', async (t) => {
  t.plan(1)
  let rawArc = `
@app
my-app
@aws
profile default
region us-west-1
@tables
users
  id *String
@storage-private
private-data
@multi-region
primary us-west-1
replicas
  us-west-2
  us-east-2
`
  let correctOptions = {
    primaryRegion: 'us-west-1',
    replicaRegions: [ 'us-west-2', 'us-east-2' ],
    bucketNames: { public: [], private: [ 'private-data' ] },
    skipTables: []
  }
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let options = getMultiRegionOptions(arc)
  t.deepEqual(options, correctOptions, 'Got correct options')
})

test('Skipping buckets from private-storage', async (t) => {
  t.plan(1)
  let rawArc = `
@app
my-app
@aws
profile default
region us-west-1
@tables
users
  id *String
@storage-private
private-data
other-private-data
@multi-region
primary us-west-1
replicas
  us-west-2
  us-east-2
skip-buckets
  private-data
`
  let correctOptions = {
    primaryRegion: 'us-west-1',
    replicaRegions: [ 'us-west-2', 'us-east-2' ],
    bucketNames: { public: [], private: [ 'other-private-data' ] },
    skipTables: []
  }
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let options = getMultiRegionOptions(arc)
  t.deepEqual(options, correctOptions, 'Got correct options')
})

test('Skipping tables', async (t) => {
  t.plan(1)
  let rawArc = `
@app
my-app
@aws
profile default
region us-west-1
@tables
users
  id *String
products
  id *String
@multi-region
primary us-west-1
replicas
  us-west-2
  us-east-2
skip-tables
  users
`
  let correctOptions = {
    primaryRegion: 'us-west-1',
    replicaRegions: [ 'us-west-2', 'us-east-2' ],
    bucketNames: { public: [], private: [] },
    skipTables: [ 'users' ]
  }
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let options = getMultiRegionOptions(arc)
  t.deepEqual(options, correctOptions, 'Got correct options')
})
