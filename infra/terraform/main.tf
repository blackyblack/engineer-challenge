# Terraform configuration for Auth Module Infrastructure
# Demonstrates IaC approach for cloud deployment

terraform {
  required_version = ">= 1.0"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {}

# PostgreSQL container
resource "docker_image" "postgres" {
  name         = "postgres:16-alpine"
  keep_locally = true
}

resource "docker_container" "postgres" {
  name  = "auth-postgres"
  image = docker_image.postgres.image_id

  env = [
    "POSTGRES_USER=auth",
    "POSTGRES_PASSWORD=auth",
    "POSTGRES_DB=auth_db",
  ]

  ports {
    internal = 5432
    external = 5432
  }

  volumes {
    host_path      = abspath("${path.module}/../migrations")
    container_path = "/docker-entrypoint-initdb.d"
  }

  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -U auth -d auth_db"]
    interval = "5s"
    timeout  = "5s"
    retries  = 5
  }
}

# Auth service container
resource "docker_image" "auth_service" {
  name = "auth-service:latest"
  build {
    context    = "${path.module}/.."
    dockerfile = "infra/docker/Dockerfile"
  }
}

resource "docker_container" "auth_service" {
  name  = "auth-service"
  image = docker_image.auth_service.image_id

  env = [
    "GRPC_PORT=50051",
    "METRICS_PORT=9090",
    "DATABASE_URL=postgresql://auth:auth@auth-postgres:5432/auth_db",
    "JWT_ACCESS_SECRET=terraform-managed-access-secret",
    "JWT_REFRESH_SECRET=terraform-managed-refresh-secret",
    "LOG_LEVEL=info",
  ]

  ports {
    internal = 50051
    external = 50051
  }

  ports {
    internal = 9090
    external = 9090
  }

  depends_on = [docker_container.postgres]
}

output "grpc_endpoint" {
  value = "localhost:50051"
}

output "metrics_endpoint" {
  value = "http://localhost:9090/metrics"
}
