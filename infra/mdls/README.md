# MDLS infra (Terraform)

Provisions the AWS-side resources Fivetran Managed Data Lake Service (MDLS) needs to land Iceberg tables for the Sentinel ODI demo: an S3 bucket, a Glue Data Catalog database, an IAM role Fivetran assumes to write, and a second IAM role Snowflake assumes (via `EXTERNAL VOLUME`) to read.

## Pre-reqs

- AWS CLI configured with credentials that can create S3 + IAM + Glue resources.
- Terraform >= 1.6.
- Fivetran account with MDLS enabled.
- Fivetran API key + secret (https://fivetran.com/account/settings/api-config).

## Apply

1. `cp terraform.tfvars.example terraform.tfvars` and fill in `fivetran_api_key`, `fivetran_api_secret`.
2. In Fivetran UI: Destinations -> Add destination -> Managed Data Lake Service. Note the **External ID** shown in the wizard. Put it in `fivetran_external_id`. Leave the Snowflake values as their placeholders.
3. `terraform init && terraform apply`. Note the outputs — you'll paste `fivetran_assume_role_arn`, `s3_bucket_name`, and `glue_database_name` back into the Fivetran wizard to finish the destination.
4. In Snowflake, create the external volume pointing at the bucket + `snowflake_assume_role_arn` (see `../snowflake_iceberg_setup.sql`).
5. **External-ID round-trip (chicken-and-egg).** Snowflake only reveals the principal it will use after the volume exists:
   ```sql
   DESCRIBE EXTERNAL VOLUME sentinel_mdls_vol;
   ```
   Copy `STORAGE_AWS_IAM_USER_ARN` into `snowflake_aws_account_id` and `STORAGE_AWS_EXTERNAL_ID` into `snowflake_external_id`, then `terraform apply` again to tighten the trust policy.

## Verifying

```bash
aws glue get-database --name "$(terraform output -raw glue_database_name)"
aws s3 ls "s3://$(terraform output -raw s3_bucket_name)/"
```

Then in the Fivetran UI, click **Test** on the MDLS destination — it should succeed. After a connector lands its first sync, `aws s3 ls --recursive` will show `metadata/` and `data/` prefixes for each Iceberg table.

## Costs

- S3 storage + requests: ~$5-15/mo for demo-scale data, lower after the 30-day lifecycle moves snapshots to STANDARD_IA.
- AWS Glue Data Catalog: free for the first million objects/requests per month — this demo never gets close.
- IAM, KMS-by-default (SSE-S3): free.

## Teardown

The bucket is versioned, so `terraform destroy` will fail unless it's emptied first.

```bash
BUCKET=$(terraform output -raw s3_bucket_name)
aws s3api delete-objects --bucket "$BUCKET" \
  --delete "$(aws s3api list-object-versions --bucket "$BUCKET" \
    --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}')"
aws s3api delete-objects --bucket "$BUCKET" \
  --delete "$(aws s3api list-object-versions --bucket "$BUCKET" \
    --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}')"
terraform destroy
```

Also delete the MDLS destination from the Fivetran UI — the provider doesn't manage it yet (see `fivetran.tf`).
