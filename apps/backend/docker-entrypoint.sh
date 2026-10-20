#!/bin/sh
set -e

# Las migraciones son idempotentes: se aplican las pendientes y se sigue.
echo "Aplicando migraciones..."
npx medusa db:migrate

echo "Iniciando Medusa..."
exec npx medusa start
