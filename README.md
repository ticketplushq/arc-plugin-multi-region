# @ticketplushq/arc-multi-region

[![Build](https://github.com/ticketplushq/arc-plugin-multi-region/actions/workflows/build.yaml/badge.svg)](https://github.com/ticketplushq/arc-plugin-multi-region/actions/workflows/build.yaml)

Allows to deploy Architect projects on multi regions using [Global Tables](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html).

## Table of contents

- [Install](#install)
- [Usage](#usage)
  - [The `@multi-region` pragma](#the-multi-region-pragma)
  - [Example](#example)
  - [Some considerations](#some-considerations)
- [Contributing](#contributing)
- [License](#license)

## Install

`npm i @ticketplushq/arc-plugin-multi-region`

Add this line to your Architect project manifest:

```arc
# app.arc
@plugins
ticketplushq/arc-plugin-multi-region
```

Then follow the directions below for `@multi-region`.

## Usage

### The `@multi-region` pragma

The `@multi-region` allows to deploy Architect projects on multi regions using DynamoDB Global Tables.

- The `primary` entry define the aws main region of your application. The region where you app is currently running.
- The `replicas` entry is an array of aws regions where you plan to deploy your application.
- The `skip-buckets` entry is an array of buckets that you want or don't want to reference.
  * This feature is only compatible with `@architect/plugin-storage-public` and `@architect/plugin-storage-private` plugins.
  * This entry is optional. By default, this plugin reference all buckets inside your project from the original region.
  * If there are any bucket that you are not interested in reference, you can add it here. We'll let architect create it, and it's up to you whether to use it or not.
- The `skip-tables` entry is an array of architect tables that you want or don't want to replicate.
  * This entry is optional. By default, this plugin replicates all tables inside your project.
  * Replicating data can be expensive. If there are any tables that you are not interested in replicating, you can add it here.
    We'll let architect create it, and it's up to you whether to use it or not.

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

> Always use the `--dry-run` flag, to test everything before deploy to the real world. You will be see some warnings, due to the nature of a dry run execution.

1. Deploy your Architect app normally with `arc deploy`
  * After a successful deployment on the primary region, will start replicating the tables in the configured regions (`us-west-2` and `us-east-2`).
  * Take a look at the console, and you will see a summary of the operation performed.
  ```
  ⚬ MultiRegion Updating replication on primary region us-west-1
  ⚬ MultiRegion Initializing replication for table users
    | Creating replication on regions ... us-west-2, us-east-2
    | Deleting replication on regions ... (skipped)
  ✓ MultiRegion Replication updated for table users
  ✓ MultiRegion Replication updated in 10.944 seconds
  ```
2. Change the `region` value on `@aws` at your `app.arc` file, to one of the replica regions (`us-west-2` or `us-east-2`), and deploy your Architect app normally with `arc deploy`
  * Before start the deployment, will start to fetching the replicated tables on the replica region, and ignoring the corresponding table that Architect try to create naturally.
  * Take a look at the console, and you will see a summary of the operation performed.
  ```
  ✓ MultiRegion Replica tables in the replica region (us-west-2) fetched
  ⚬ MultiRegion Fetched replica tables in the replica region (us-west-2)
    | users
  ```
3. Repeat the step two for each replica region.

As a result of the above you will have 2 or more api gateway endpoints, to balance in case of failure in a region.

### Some considerations

* Architect don't delete your tables, so if you remove a table from app.arc, you must to manually remove each replica and the table itself.
* The indexes are replicated without problem, so don't concern about it.
* Due to AWS API limitations, we can only create/delete one region at a time for each table. So if you add two or more regions to each table. The deployment will wait for the replication update to finish, to add a new region in the same table, and only then continue with the next table. Instead, if you only add one replica region at a time, it won't wait for the replication update.
* It can take aws a long time to make a table available in another region, and if it is not available, the deploy in the replica region could fail. However, as soon as it is ready, the deployment will finish successfully.
* There is many behaviors related to events, queues and crons that you should be considering before to move to a multi region architecture.
  In the context of lambda functions, there are some environment variables (`ARC_MULTI_REGION_PRIMARY` and `ARC_MULTI_REGION_CURRENT`, with the corresponding aws region) useful to condition some logic.

## Maintainer

[@ticketplushq](https://github.com/ticketplushq)

## Contributing

Feel free to dive in! Open an issue or submit PRs.

## License

Apache License 2.0 © 2022 Ticketplus
