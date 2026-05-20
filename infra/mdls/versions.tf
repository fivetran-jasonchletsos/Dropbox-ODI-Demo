terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    fivetran = {
      source  = "fivetran/fivetran"
      version = "~> 1.1"
    }
  }
}
