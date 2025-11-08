#!/bin/bash

# Test script for /transactions endpoint

echo "======================================"
echo "Testing /transactions endpoint"
echo "======================================"
echo ""

SERVER_URL="http://localhost:4000"
REMOTE_URL="http://162.250.126.66:4000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing localhost endpoint...${NC}"
echo ""

# Test 1: Basic request
echo "Test 1: Fetch first 10 transactions"
echo "Request:"
cat <<EOF
{
  "address": "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
  "providerId": "X1-testnet",
  "limit": 10,
  "offset": 0
}
EOF

echo ""
echo "Response:"
curl -s -X POST ${SERVER_URL}/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "address": "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
    "providerId": "X1-testnet",
    "limit": 10,
    "offset": 0
  }' | jq '.'

echo ""
echo "======================================"
echo ""

# Test 2: Pagination
echo "Test 2: Fetch next 5 transactions (offset: 10)"
echo "Request:"
cat <<EOF
{
  "address": "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
  "providerId": "X1-testnet",
  "limit": 5,
  "offset": 10
}
EOF

echo ""
echo "Response:"
curl -s -X POST ${SERVER_URL}/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "address": "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
    "providerId": "X1-testnet",
    "limit": 5,
    "offset": 10
  }' | jq '{
    transactionCount: .transactions | length,
    hasMore: .hasMore,
    totalCount: .totalCount,
    firstTx: .transactions[0].type
  }'

echo ""
echo "======================================"
echo ""
echo -e "${GREEN}✓ Tests complete!${NC}"
echo ""
echo "To test the remote server (after deployment):"
echo "  sed 's|localhost|162.250.126.66|g' test-transactions-endpoint.sh | bash"
