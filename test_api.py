"""
API Test Script - Tests all endpoints
Run: python test_api.py
"""

import requests
import json
from datetime import datetime

# Base URL - Change this if your server runs on a different port
BASE_URL = "https://rahul-n9lj.onrender.com/api"

# Colors for console output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_header(title):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{title.center(60)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}\n")

def print_endpoint(method, endpoint):
    color = Colors.GREEN if method == "GET" else Colors.YELLOW if method == "POST" else Colors.BLUE if method == "PUT" else Colors.RED
    print(f"{color}{Colors.BOLD}[{method}]{Colors.END} {endpoint}")

def print_response(response, show_full=False):
    status_color = Colors.GREEN if response.status_code < 400 else Colors.RED
    print(f"  Status: {status_color}{response.status_code}{Colors.END}")
    try:
        data = response.json()
        if show_full:
            print(f"  Response: {json.dumps(data, indent=4)}")
        else:
            # Show truncated response
            response_str = json.dumps(data)
            if len(response_str) > 200:
                print(f"  Response: {response_str[:200]}...")
            else:
                print(f"  Response: {response_str}")
    except:
        print(f"  Response: {response.text[:200] if len(response.text) > 200 else response.text}")
    print()

def test_endpoint(method, endpoint, data=None, params=None, show_full=False):
    url = f"{BASE_URL}{endpoint}"
    print_endpoint(method, endpoint)
    try:
        if method == "GET":
            response = requests.get(url, params=params)
        elif method == "POST":
            response = requests.post(url, json=data)
        elif method == "PUT":
            response = requests.put(url, json=data)
        elif method == "DELETE":
            response = requests.delete(url)
        print_response(response, show_full)
        return response
    except requests.exceptions.ConnectionError:
        print(f"  {Colors.RED}Error: Cannot connect to server. Make sure server is running on {BASE_URL}{Colors.END}\n")
        return None

# ============================================
# TEST DATA
# ============================================

# Sample User Data
sample_user = {
    "name": "Test User",
    "shopName": "Test Shop",
    "address": "123 Test Street",
    "town": "Test Town",
    "state": "Test State",
    "pincode": 123456,
    "contact": [
        {"contact": "+919876543210", "whatsapp": True}
    ],
    "delivery": 50,
    "dues": 0
}

# Sample Product Data
sample_product = {
    "productName": "Test Product",
    "weight": "500g",
    "unit": "g",
    "mrp": 100,
    "rate": 90,
    "productImage": [{"image": "https://example.com/image.jpg"}]
}

# Sample Order Data (simplified)
sample_order = {
    "userId": "",  # Will be filled after creating user
    "products": [
        {"productId": "", "quantity": 2}  # Will be filled after creating product
    ],
    "moneyGiven": 100,
    "paymentMethod": "Cash"
}

# Sample Company Data
sample_company = {
    "name": "Durga Sai Enterprises",
    "contactUs": "+91 9876543210",
    "email": "contact@durgasai.com",
    "regNumber": "RAN5207102024166530",
    "address": "123 Main Street",
    "city": "Hyderabad",
    "state": "Telangana",
    "pincode": "500001"
}

# ============================================
# MAIN TEST FUNCTION
# ============================================

def run_all_tests():
    print(f"\n{Colors.BOLD}{Colors.GREEN}Starting API Tests...{Colors.END}")
    print(f"Base URL: {BASE_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    created_user_id = None
    created_product_id = None
    created_order_id = None

    # ============================================
    # 1. SETTINGS ENDPOINTS
    # ============================================
    print_header("SETTINGS ENDPOINTS")

    # Get Company Details
    test_endpoint("GET", "/settings/company", show_full=True)

    # Update Company Details
    test_endpoint("POST", "/settings/company", data=sample_company, show_full=True)

    # Verify PIN (default: 0000)
    test_endpoint("POST", "/settings/verify-pin", data={"pin": "0000"}, show_full=True)

    # Update PIN
    test_endpoint("POST", "/settings/update-pin", data={"currentPin": "0000", "newPin": "1234"}, show_full=True)

    # Verify new PIN
    test_endpoint("POST", "/settings/verify-pin", data={"pin": "1234"}, show_full=True)

    # Reset PIN back to 0000
    test_endpoint("POST", "/settings/update-pin", data={"currentPin": "1234", "newPin": "0000"}, show_full=True)

    # ============================================
    # 2. USER ENDPOINTS
    # ============================================
    print_header("USER ENDPOINTS")

    # Get all users
    test_endpoint("GET", "/users")

    # Create a user
    response = test_endpoint("POST", "/users", data=sample_user, show_full=True)
    if response and response.status_code == 201:
        try:
            created_user_id = response.json().get("user", {}).get("userId") or response.json().get("userId")
            print(f"  {Colors.GREEN}Created User ID: {created_user_id}{Colors.END}\n")
        except:
            pass

    # Get specific user (if created)
    if created_user_id:
        test_endpoint("GET", f"/users/{created_user_id}", show_full=True)

    # Update user
    if created_user_id:
        update_data = {"name": "Updated Test User", "dues": 500}
        test_endpoint("PUT", f"/users/{created_user_id}", data=update_data)

    # Search users
    test_endpoint("POST", "/users/search", data={"query": "Test"})

    # ============================================
    # 3. PRODUCT ENDPOINTS
    # ============================================
    print_header("PRODUCT ENDPOINTS")

    # Get all products
    test_endpoint("GET", "/products")

    # Create a product
    response = test_endpoint("POST", "/products", data=sample_product, show_full=True)
    if response and response.status_code == 201:
        try:
            created_product_id = response.json().get("product", {}).get("productId") or response.json().get("productId")
            print(f"  {Colors.GREEN}Created Product ID: {created_product_id}{Colors.END}\n")
        except:
            pass

    # Get specific product
    if created_product_id:
        test_endpoint("GET", f"/products/{created_product_id}", show_full=True)

    # Update product
    if created_product_id:
        update_data = {"rate": 85, "mrp": 95}
        test_endpoint("PUT", f"/products/{created_product_id}", data=update_data)

    # Search products
    test_endpoint("POST", "/products/search", data={"query": "Test"})

    # ============================================
    # 4. ORDER ENDPOINTS
    # ============================================
    print_header("ORDER ENDPOINTS")

    # Get all orders
    test_endpoint("GET", "/orders")

    # Create order (if user and product exist)
    if created_user_id and created_product_id:
        order_data = {
            "userId": created_user_id,
            "products": [
                {"productId": created_product_id, "quantity": 2}
            ],
            "moneyGiven": 50,
            "paymentMethod": "Cash"
        }

        # Order Review
        test_endpoint("POST", "/orders/review", data=order_data, show_full=True)

        # Create Order
        response = test_endpoint("POST", "/orders", data=order_data, show_full=True)
        if response and response.status_code == 201:
            try:
                created_order_id = response.json().get("data", {}).get("orderId")
                print(f"  {Colors.GREEN}Created Order ID: {created_order_id}{Colors.END}\n")
            except:
                pass

    # Get specific order
    if created_order_id:
        test_endpoint("GET", f"/orders/{created_order_id}", show_full=True)

    # Search orders
    test_endpoint("POST", "/orders/search", data={"query": "Test"})

    # ============================================
    # 5. DUES ENDPOINTS
    # ============================================
    print_header("DUES ENDPOINTS")

    if created_user_id:
        # Get user dues
        test_endpoint("GET", f"/dues/{created_user_id}", show_full=True)

        # Get dues history
        test_endpoint("GET", f"/dues/{created_user_id}/history", show_full=True)

        # Pay dues - correct endpoint is POST /dues/:userId/pay
        dues_payment = {
            "amount": 100,
            "paymentMethod": "Cash"
        }
        test_endpoint("POST", f"/dues/{created_user_id}/pay", data=dues_payment, show_full=True)

    # ============================================
    # 6. USER HISTORY ENDPOINTS
    # ============================================
    print_header("USER HISTORY ENDPOINTS")

    # Get all user history
    test_endpoint("GET", "/user-history")

    # Search user history
    test_endpoint("POST", "/user-history/search", data={"query": "Test"})

    # ============================================
    # 7. PRODUCT HISTORY ENDPOINTS
    # ============================================
    print_header("PRODUCT HISTORY ENDPOINTS")

    # Get all product history
    test_endpoint("GET", "/product-history")

    # Search product history
    test_endpoint("POST", "/product-history/search", data={"query": "Test"})

    # ============================================
    # 8. STATS ENDPOINTS
    # ============================================
    print_header("STATS ENDPOINTS")

    # Correct endpoint is /stats/dashboard
    test_endpoint("GET", "/stats/dashboard", show_full=True)

    # ============================================
    # 9. GLOBAL SEARCH ENDPOINTS
    # ============================================
    print_header("GLOBAL SEARCH ENDPOINTS")

    # Global search uses GET with query param
    test_endpoint("GET", "/search/products?q=Test", show_full=True)
    test_endpoint("GET", "/search/orders?q=Test", show_full=True)
    test_endpoint("GET", "/search/users?q=Test", show_full=True)

    # ============================================
    # 10. PDF ENDPOINTS (Just show URLs)
    # ============================================
    print_header("PDF ENDPOINTS")

    print(f"{Colors.YELLOW}PDF endpoints return binary files. Open these URLs in browser:{Colors.END}\n")

    if created_order_id:
        print(f"  Order Invoice: {BASE_URL}/orders/{created_order_id}/invoice")

    if created_user_id:
        print(f"  User History PDF: {BASE_URL}/user-history/user/{created_user_id}/history-pdf")

    if created_product_id:
        print(f"  Product History PDF: {BASE_URL}/product-history/product/{created_product_id}/history-pdf")

    print()

    # ============================================
    # CLEANUP (Optional - Uncomment to delete test data)
    # ============================================
    print_header("CLEANUP (DELETE TEST DATA)")

    # Delete order
    if created_order_id:
        test_endpoint("DELETE", f"/orders/{created_order_id}", show_full=True)

    # Delete product
    if created_product_id:
        test_endpoint("DELETE", f"/products/{created_product_id}", show_full=True)

    # Delete user
    if created_user_id:
        test_endpoint("DELETE", f"/users/{created_user_id}", show_full=True)

    # ============================================
    # SUMMARY
    # ============================================
    print_header("TEST COMPLETE")
    print(f"{Colors.GREEN}All endpoint tests completed!{Colors.END}")
    print(f"\nCreated IDs during test:")
    print(f"  User ID: {created_user_id or 'None'}")
    print(f"  Product ID: {created_product_id or 'None'}")
    print(f"  Order ID: {created_order_id or 'None'}")
    print()

# ============================================
# INDIVIDUAL TEST FUNCTIONS
# ============================================

def test_settings_only():
    """Test only settings endpoints"""
    print_header("SETTINGS ENDPOINTS TEST")

    test_endpoint("GET", "/settings/company", show_full=True)
    test_endpoint("POST", "/settings/company", data=sample_company, show_full=True)
    test_endpoint("POST", "/settings/verify-pin", data={"pin": "0000"}, show_full=True)

def test_users_only():
    """Test only user endpoints"""
    print_header("USER ENDPOINTS TEST")

    test_endpoint("GET", "/users")
    # Add more as needed

def test_products_only():
    """Test only product endpoints"""
    print_header("PRODUCT ENDPOINTS TEST")

    test_endpoint("GET", "/products")
    # Add more as needed

def test_orders_only():
    """Test only order endpoints"""
    print_header("ORDER ENDPOINTS TEST")

    test_endpoint("GET", "/orders")
    # Add more as needed

# ============================================
# ENTRY POINT
# ============================================

if __name__ == "__main__":
    print(f"""
{Colors.BOLD}{Colors.CYAN}
============================================================
                    API TEST SCRIPT

  This script tests all API endpoints
  Server: {BASE_URL}
============================================================
{Colors.END}
    """)

    # Run all tests
    run_all_tests()

    # Or run individual tests:
    # test_settings_only()
    # test_users_only()
    # test_products_only()
    # test_orders_only()
