#!/bin/bash

# Access Management System - End-to-End Test Workflow
# This script tests the complete workflow of the application

API_BASE="http://localhost:3000/api/v1"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Access Management System - E2E Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if server is running
echo -e "${BLUE}1. Checking if server is running...${NC}"
if curl -s "$API_BASE/systems" > /dev/null; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not running. Please start it with: npm run start:dev${NC}"
    exit 1
fi
echo ""

# Step 1: Create Users (with unique timestamps)
TIMESTAMP=$(date +%s)
echo -e "${BLUE}2. Creating test users...${NC}"
USER1_RESPONSE=$(curl -s -X POST "$API_BASE/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"john.doe.$TIMESTAMP@silvertree.com\",\"name\":\"John Doe $TIMESTAMP\"}")
USER1_ID=$(echo $USER1_RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('id', ''))" 2>/dev/null)
if [ -z "$USER1_ID" ]; then
    # User might already exist, try to get by email
    USER1_RESPONSE=$(curl -s "$API_BASE/users" | python3 -c "import sys, json; users=json.load(sys.stdin).get('data', []); user=next((u for u in users if 'john.doe' in u.get('email', '')), None); print(json.dumps(user) if user else '{}')" 2>/dev/null)
    USER1_ID=$(echo $USER1_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
fi
echo "User 1: John Doe (ID: $USER1_ID)"
echo "$USER1_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$USER1_RESPONSE"
echo ""

USER2_RESPONSE=$(curl -s -X POST "$API_BASE/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"jane.smith.$TIMESTAMP@silvertree.com\",\"name\":\"Jane Smith $TIMESTAMP\"}")
USER2_ID=$(echo $USER2_RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('id', ''))" 2>/dev/null)
if [ -z "$USER2_ID" ]; then
    USER2_RESPONSE=$(curl -s "$API_BASE/users" | python3 -c "import sys, json; users=json.load(sys.stdin).get('data', []); user=next((u for u in users if 'jane.smith' in u.get('email', '')), None); print(json.dumps(user) if user else '{}')" 2>/dev/null)
    USER2_ID=$(echo $USER2_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
fi
echo "User 2: Jane Smith (ID: $USER2_ID)"
echo "$USER2_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$USER2_RESPONSE"
echo ""

# Step 2: Assign Manager
echo -e "${BLUE}3. Assigning manager (Jane is John's manager)...${NC}"
MANAGER_RESPONSE=$(curl -s -X PATCH "$API_BASE/users/$USER1_ID/manager" \
  -H "Content-Type: application/json" \
  -d "{\"managerId\":\"$USER2_ID\"}")
echo "$MANAGER_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$MANAGER_RESPONSE"
echo -e "${GREEN}✅ Manager assigned${NC}"
echo ""

# Step 3: Create System
echo -e "${BLUE}4. Creating a system (Acumatica)...${NC}"
SYSTEM_RESPONSE=$(curl -s -X POST "$API_BASE/systems" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Acumatica $TIMESTAMP\",\"description\":\"ERP System\"}")
SYSTEM_ID=$(echo $SYSTEM_RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('id', ''))" 2>/dev/null)
if [ -z "$SYSTEM_ID" ]; then
    # System might already exist, get first system
    SYSTEM_RESPONSE=$(curl -s "$API_BASE/systems" | python3 -c "import sys, json; systems=json.load(sys.stdin); print(json.dumps(systems[0] if isinstance(systems, list) and len(systems) > 0 else {}))" 2>/dev/null)
    SYSTEM_ID=$(echo $SYSTEM_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
fi
echo "System: Acumatica (ID: $SYSTEM_ID)"
echo "$SYSTEM_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SYSTEM_RESPONSE"
echo ""

# Step 4: Create System Instance
if [ -n "$SYSTEM_ID" ]; then
    echo -e "${BLUE}5. Creating system instance (US Production)...${NC}"
    INSTANCE_RESPONSE=$(curl -s -X POST "$API_BASE/systems/$SYSTEM_ID/instances" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"US Production $TIMESTAMP\",\"region\":\"US\",\"environment\":\"production\"}")
    INSTANCE_ID=$(echo $INSTANCE_RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('id', ''))" 2>/dev/null)
    echo "Instance: US Production (ID: $INSTANCE_ID)"
    echo "$INSTANCE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$INSTANCE_RESPONSE"
    echo ""
else
    echo -e "${RED}⚠️  Skipping instance creation - no system ID${NC}"
    echo ""
fi

# Step 5: Create Access Tier
if [ -n "$SYSTEM_ID" ]; then
    echo -e "${BLUE}6. Creating access tier (Admin)...${NC}"
    TIER_RESPONSE=$(curl -s -X POST "$API_BASE/systems/$SYSTEM_ID/access-tiers" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"admin-$TIMESTAMP\",\"description\":\"Full administrative access\"}")
    TIER_ID=$(echo $TIER_RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('id', ''))" 2>/dev/null)
    echo "Tier: admin (ID: $TIER_ID)"
    echo "$TIER_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TIER_RESPONSE"
    echo ""
else
    echo -e "${RED}⚠️  Skipping tier creation - no system ID${NC}"
    echo ""
fi

# Step 6: Verify what we created
echo -e "${BLUE}7. Verifying created data...${NC}"
echo -e "${BLUE}   All Users (showing first 3):${NC}"
curl -s "$API_BASE/users?page=1&limit=3" | python3 -m json.tool 2>/dev/null | head -40 || curl -s "$API_BASE/users?page=1&limit=3" | head -40
echo ""
echo -e "${BLUE}   All Systems (showing first 3):${NC}"
curl -s "$API_BASE/systems" | python3 -c "import sys, json; systems=json.load(sys.stdin); print(json.dumps(systems[:3] if isinstance(systems, list) else systems, indent=2))" 2>/dev/null | head -30 || curl -s "$API_BASE/systems" | head -30
echo ""
if [ -n "$SYSTEM_ID" ]; then
    echo -e "${BLUE}   System Instances for System $SYSTEM_ID:${NC}"
    curl -s "$API_BASE/systems/$SYSTEM_ID/instances" | python3 -m json.tool 2>/dev/null || curl -s "$API_BASE/systems/$SYSTEM_ID/instances"
    echo ""
    echo -e "${BLUE}   Access Tiers for System $SYSTEM_ID:${NC}"
    curl -s "$API_BASE/systems/$SYSTEM_ID/access-tiers" | python3 -m json.tool 2>/dev/null || curl -s "$API_BASE/systems/$SYSTEM_ID/access-tiers"
    echo ""
else
    echo -e "${RED}⚠️  Skipping instance/tier verification - no system ID${NC}"
    echo ""
fi

# Step 7: Test Access Overview (should be empty initially)
echo -e "${BLUE}8. Testing Access Overview (should be empty)...${NC}"
OVERVIEW_RESPONSE=$(curl -s "$API_BASE/access-overview?page=1&limit=10")
echo "$OVERVIEW_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$OVERVIEW_RESPONSE"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Basic workflow test complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Create access grants (when that feature is implemented)"
echo "2. Test filtering on access overview"
echo "3. Test pagination and sorting"
echo ""
echo "To test manually, use the test-api.html file or curl commands."

