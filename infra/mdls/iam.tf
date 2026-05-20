data "aws_caller_identity" "current" {}

# Fivetran requires an IAM role with sts:ExternalId matching the value shown
# in the MDLS destination setup UI.
# Source: https://fivetran.com/docs/destinations/managed-data-lake-service/aws-setup-guide
data "aws_iam_policy_document" "fivetran_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.fivetran_aws_account_id}:root"]
    }

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [var.fivetran_external_id]
    }
  }
}

data "aws_iam_policy_document" "fivetran_permissions" {
  statement {
    sid    = "FivetranS3Object"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${aws_s3_bucket.mdls.arn}/*"]
  }

  statement {
    sid    = "FivetranS3Bucket"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation",
    ]
    resources = [aws_s3_bucket.mdls.arn]
  }

  statement {
    sid    = "FivetranGlue"
    effect = "Allow"
    actions = [
      "glue:CreateTable",
      "glue:UpdateTable",
      "glue:DeleteTable",
      "glue:GetTable",
      "glue:GetTables",
      "glue:GetDatabase",
      "glue:GetPartitions",
      "glue:BatchCreatePartition",
      "glue:BatchUpdatePartition",
      "glue:BatchDeletePartition",
    ]
    resources = [
      "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:catalog",
      aws_glue_catalog_database.mdls.arn,
      "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${aws_glue_catalog_database.mdls.name}/*",
    ]
  }
}

resource "aws_iam_role" "fivetran_mdls" {
  name               = "sentinel-fivetran-mdls"
  assume_role_policy = data.aws_iam_policy_document.fivetran_trust.json
  tags               = local.tags
}

resource "aws_iam_role_policy" "fivetran_mdls" {
  name   = "sentinel-fivetran-mdls-policy"
  role   = aws_iam_role.fivetran_mdls.id
  policy = data.aws_iam_policy_document.fivetran_permissions.json
}

# Snowflake reveals its IAM user ARN + external ID only after the EXTERNAL VOLUME
# is created and DESCRIBE EXTERNAL VOLUME is run. First apply uses placeholders;
# update tfvars and re-apply to lock the trust policy down.
data "aws_iam_policy_document" "snowflake_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type = "AWS"
      identifiers = [
        var.snowflake_aws_account_id != ""
        ? var.snowflake_aws_account_id
        : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root",
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [var.snowflake_external_id]
    }
  }
}

data "aws_iam_policy_document" "snowflake_permissions" {
  statement {
    sid    = "SnowflakeS3Object"
    effect = "Allow"
    actions = [
      "s3:GetObject",
    ]
    resources = ["${aws_s3_bucket.mdls.arn}/*"]
  }

  statement {
    sid    = "SnowflakeS3Bucket"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation",
    ]
    resources = [aws_s3_bucket.mdls.arn]
  }

  statement {
    sid    = "SnowflakeGlue"
    effect = "Allow"
    actions = [
      "glue:GetDatabase",
      "glue:GetTable",
      "glue:GetTables",
      "glue:GetPartitions",
      "glue:GetPartition",
    ]
    resources = [
      "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:catalog",
      aws_glue_catalog_database.mdls.arn,
      "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${aws_glue_catalog_database.mdls.name}/*",
    ]
  }
}

resource "aws_iam_role" "snowflake_mdls_reader" {
  name               = "sentinel-snowflake-mdls-reader"
  assume_role_policy = data.aws_iam_policy_document.snowflake_trust.json
  tags               = local.tags
}

resource "aws_iam_role_policy" "snowflake_mdls_reader" {
  name   = "sentinel-snowflake-mdls-reader-policy"
  role   = aws_iam_role.snowflake_mdls_reader.id
  policy = data.aws_iam_policy_document.snowflake_permissions.json
}
