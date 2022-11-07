<p align="center">
  <img src="https://avatars1.githubusercontent.com/u/30219716?s=200&v=4"/>
</p>

# @ticketplushq/arc-plugin-multi-region

Allows to deploy Architect projects on multi regions using DynamoDB Global Tables


## Install

`npm i @ticketplushq/arc-plugin-multi-region`

Add this line to your Architect project manifest:

```arc
# app.arc
@plugins
arc-plugin-multi-region
```

Then follow the directions below for `@arc-plugin-multi-region`.

> Note: this plugin currently only supports enabling access to tables that previously global tables. For example: if your app is in `us-west-1`, this plugin will not enable access to external tables in `us-east-1` unless you active the replication of each table for `us-east-1`.

---

## `@arc-plugin-multi-region`

The `@arc-plugin-multi-region` allows to deploy Architect projects on multi regions using DynamoDB Global Tables.

- The `primary` entry define the aws main region of your application. The region where you app is currently running.

- The `replicas` entry is an array of aws regions where you plan to deploy your application.

### Example

In the following example we have an Architect app (`my-app`) wich is currently deployed on `us-west-1` region, and we whant to replicate the app in `us-west-2` and `us-east-2` regions.

```arc
@app
my-app

@aws
profile default
region us-west-1          # region where you want to deploy this Architect app

@plugins
arc-plugin-multi-region

@tables                   # tables managed by this Architect app
users
  id *String

@arc-plugin-multi-region
primary us-west-1         # region where you app is currently running
replicas                  # additional regions where you want to deploy you Architect app
  us-west-2
  us-east-2
```

If we deploy this app.arc nothing would be happen, due to the current `region` in `@aws` has the same value as `primary` in `@arc-plugin-multi-region`. If we change the `region` on `@aws`, to deploy to one of the `replicas` regions, will be validate if all tables are already replicated on that region and init the deployment.

### Global Table

[Global Table is a feature of DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html) that allows you to replicate DynamoDB tables across multiple regions.

This plugin does not have the ability to enable existing tables in multiple regions. However, you can do it yourself using the AWS console interface.

1. Go to each table that you have, an create a new replica for each one (Replicas are on Global tables tab).
2. Select the target region where do you want to replicate the Architect project.

Replication can take several minutes, depending on the size of the tables.
