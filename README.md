<p align="center">
  <img src="https://avatars1.githubusercontent.com/u/30219716?s=200&v=4"/>
</p>

# @ticketplushq/arc-plugin-multi-region

Allows to deploy Architect projects on multi regions using [Global Tables](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html).

## Install

`npm i @ticketplushq/arc-plugin-multi-region`

Add this line to your Architect project manifest:

```arc
# app.arc
@plugins
ticketplushq/arc-plugin-multi-region
```

Then follow the directions below for `@multi-region`.

## `@multi-region`

The `@multi-region` allows to deploy Architect projects on multi regions using DynamoDB Global Tables.

- The `primary` entry define the aws main region of your application. The region where you app is currently running.
- The `replicas` entry is an array of aws regions where you plan to deploy your application.

### Example

In the following example we have an Architect app (`my-app`) which is currently deployed on `us-west-1` region, and we want to replicate the app in `us-west-2` and `us-east-2` regions.

```arc
@app
my-app

@aws
profile default
region us-west-1          # region where you want to deploy this Architect app

@plugins
ticketplushq/arc-plugin-multi-region

@tables                   # tables managed by this Architect app
users
  id *String

@multi-region
primary us-west-1         # region where you app is currently running
replicas                  # additional regions where you want to deploy you Architect app
  us-west-2
  us-east-2
```

In order to deploy this app to multiple regions (us-west-1, us-west-2, and us-east-2, according to the example) we need to follow this instructions.

1. Always use the `--dry-run` flag, to test this before deploy everything to the real world.
  * You will be see some warnings, due to the nature of a dry run execution.
2. Deploy your Architect app normally
  * After a successful deployment, will start replicating the tables in the configured regions (`us-west-2` and `us-east-2`).
  * Take a look at the console, and you will see a summary of the operation performed.
  ```
  ⚬ MultiRegion Updating replication on primary region us-west-1
  ⚬ MultiRegion Initializing replication for table users
    | Creating replication on regions ... us-west-2, us-east-2
    | Deleting replication on regions ... (skipped)
  ✓ MultiRegion Replication updated for table users
  ✓ MultiRegion Replication updated in 10.944 seconds
  ```
3. Change the `region` value on `@aws` at your `app.arc` file, to one of the replica regions (`us-west-2` or `us-east-2`)
  * Before start the deployment, will start to fetching the replicated tables on the replica region, and ignoring the corresponding table that Architect try to create naturally.
  * Take a look at the console, and you will see a summary of the operation performed.
  ```
  ✓ MultiRegion Replica tables in the replica region (us-west-2) fetched
  ⚬ MultiRegion Fetched replica tables in the replica region (us-west-2)
    | users
  ```
4. Repeat the step two for each replica region.

As a result of the above you will have 2 or more api endpoints, to balance in case of failure in a region.

### Some considerations

* By default, architect don't delete your tables, so if you remove a table from app.arc, you must to manually remove each replica and the table itself.
* The indexes are replicated without problem, so don't concern about it.
* There is many behaviors related to events, queues and crons that you should be considering before to move to a multi region architecture.
