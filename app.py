from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
import mysql.connector
from functools import wraps
from mysql.connector import Error
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
import os
from werkzeug.utils import secure_filename
from datetime import datetime
from authlib.integrations.flask_client import OAuth

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Secure random secret key for sessions; store safely in prod
UPLOAD_FOLDER = 'static/uploads/profile_pics'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- OAuth Configurations ---
# IMPORTANT: Replace with your actual credentials and store them securely (e.g., environment variables)
app.config['GOOGLE_CLIENT_ID'] = os.environ.get('GOOGLE_CLIENT_ID', 'YOUR_GOOGLE_CLIENT_ID_HERE')
app.config['GOOGLE_CLIENT_SECRET'] = os.environ.get('GOOGLE_CLIENT_SECRET', 'YOUR_GOOGLE_CLIENT_SECRET_HERE')
app.config['FACEBOOK_CLIENT_ID'] = os.environ.get('FACEBOOK_CLIENT_ID', 'YOUR_FACEBOOK_CLIENT_ID_HERE')
app.config['FACEBOOK_CLIENT_SECRET'] = os.environ.get('FACEBOOK_CLIENT_SECRET', 'YOUR_FACEBOOK_CLIENT_SECRET_HERE')
app.config['SERVER_NAME'] = '127.0.0.1:5000' # Required for url_for with _external=True

oauth = OAuth(app)

def get_db_connection():
    try:
        return mysql.connector.connect(
            host="localhost",
            user="root",
            password="@uttej123*",
            database="lumoradb",  # Use your actual DB name
            connection_timeout=5  # Fail after 5 seconds instead of hanging
        )
    except Error as e:
        print("DB connection error:", e)
        return None

oauth.register(
    name='google',
    client_id=app.config['GOOGLE_CLIENT_ID'],
    client_secret=app.config['GOOGLE_CLIENT_SECRET'],
    access_token_url='https://accounts.google.com/o/oauth2/token',
    access_token_params=None,
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params=None,
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    userinfo_endpoint='https://openidconnect.googleapis.com/v1/userinfo',
    client_kwargs={'scope': 'openid email profile'},
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration'
)

oauth.register(
    name='facebook',
    client_id=app.config['FACEBOOK_CLIENT_ID'],
    client_secret=app.config['FACEBOOK_CLIENT_SECRET'],
    access_token_url='https://graph.facebook.com/oauth/access_token',
    authorize_url='https://www.facebook.com/dialog/oauth',
    api_base_url='https://graph.facebook.com/',
    client_kwargs={'scope': 'email'},
    userinfo_endpoint='me?fields=id,name,email,picture{url}'
)


@app.context_processor
def inject_cart_data():
    cart_item_count = 0
    if 'user_id' in session:
        conn = get_db_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT SUM(quantity) FROM cart_items WHERE user_id = %s", (session['user_id'],))
                    result = cur.fetchone()
                    if result and result[0]:
                        cart_item_count = int(result[0])
            except Error as e:
                print(f"Error fetching cart count: {e}")
            finally:
                if conn.is_connected():
                    conn.close()
    else:
        # For guest users, use the session cart
        cart = session.get('cart', {})
        cart_item_count = sum(cart.values())
        
    return dict(session=session, cart_item_count=cart_item_count)

@app.route('/')
def landing_page():
    """Serves the new animated landing/login page."""
    if 'user_id' in session:
        return redirect(url_for('home'))
    return render_template('landing.html')

@app.route('/home')
def home():
    """Homepage now shows products."""
    conn = get_db_connection()
    products = []
    if conn:
        try:
            with conn.cursor(dictionary=True) as cur:
                cur.execute("SELECT * FROM products ORDER BY category, name")
                products = cur.fetchall()
        except Error as e:
            flash(f"Could not load menu items: {e}", "danger")
        finally:
            if conn.is_connected(): conn.close()
    return render_template('index.html', products=products)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash("Please log in to access this page.", "warning")
            return redirect(url_for('landing_page'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin'):
            flash("You must be an admin to view this page.", "warning")
            return redirect(url_for('admin_login_page'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/my-profile', methods=['GET', 'POST'])
@login_required
def my_profile_page():
    user_id = session['user_id']
    conn = get_db_connection()
    if not conn:
        flash("Database connection failed.", "danger") 
        return redirect(url_for('home'))

    if request.method == 'POST':
        cur = None
        try:
            cur = conn.cursor()
            # Handle file upload
            if 'profile-picture' in request.files:
                file = request.files['profile-picture']
                if file and file.filename != '' and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    # To avoid filename collisions, prepend user_id and timestamp
                    unique_filename = f"{user_id}_{int(datetime.now().timestamp())}_{filename}"
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                    file.save(filepath)
                    
                    # Update profile picture URL in the database
                    db_filepath = os.path.join(UPLOAD_FOLDER, unique_filename).replace('\\', '/')
                    cur.execute("UPDATE user_details SET profile_picture_url = %s WHERE profile_id = %s", (db_filepath, user_id))
                    session['profile_pic_url'] = db_filepath # Update session

            # Handle other form fields
            fullname = request.form.get('fullName')
            phone = request.form.get('phone')
            
            cur.execute("""
                UPDATE user_details SET name = %s, contact = %s, address_line1 = %s, city = %s, state = %s, pincode = %s WHERE profile_id = %s
            """, (fullname, phone, request.form.get('address_line1'), request.form.get('city'), request.form.get('state'), request.form.get('pincode'), user_id))
            
            # Also update the username in the main profile table and session 
            cur.execute("UPDATE profile SET username = %s WHERE user_id = %s", (fullname, user_id))
            session['username'] = fullname

            conn.commit()
            flash("Profile updated successfully!", "success")
        except Error as e:
            conn.rollback()
            print("DB error updating profile:", e)
            flash("An error occurred while updating your profile.", "danger")
        finally:
            if cur: cur.close()
            if conn.is_connected(): conn.close()
        return redirect(url_for('my_profile_page'))

    # --- GET request logic ---
    user_data = None
    orders = []
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute("""
                SELECT p.username, p.email, d.name, d.contact, d.profile_picture_url, d.address_line1, d.city, d.state, d.pincode
                FROM profile p LEFT JOIN user_details d ON p.user_id = d.profile_id WHERE p.user_id = %s
            """, (user_id,))
            user_data = cur.fetchone()

            # Fetch user's orders
            cur.execute("""
                SELECT order_id, total_amount, status, created_at FROM orders
                WHERE user_id = %s ORDER BY created_at DESC LIMIT 5
            """, (user_id,))
            orders = cur.fetchall()

    except Error as e:
        print("DB error fetching profile:", e)
        flash("Could not load your profile.", "danger")
    finally:
        if conn.is_connected(): conn.close()

    if not user_data:
        flash("Could not find your profile data.", "danger")
        user_data = None

    return render_template('my-profile.html', user=user_data, orders=orders)

@app.route('/change-password', methods=['POST'])
def change_password():
    if 'user_id' not in session:
        flash("You must be logged in to change your password.", "warning")
        return redirect(url_for('landing_page'))

    user_id = session['user_id']
    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')
    confirm_new_password = request.form.get('confirm_new_password')

    if not all([current_password, new_password, confirm_new_password]):
        flash("Please fill out all password fields.", "warning")
        return redirect(url_for('my_profile_page'))

    if new_password != confirm_new_password:
        flash("New passwords do not match.", "warning")
        return redirect(url_for('my_profile_page'))

    conn = get_db_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for('my_profile_page'))

    cur = None
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT password FROM profile WHERE user_id = %s", (user_id,))
        user = cur.fetchone()

        if user and check_password_hash(user['password'], current_password):
            hashed_password = generate_password_hash(new_password)
            cur.execute("UPDATE profile SET password = %s WHERE user_id = %s", (hashed_password, user_id))
            conn.commit()
            flash("Password updated successfully.", "success")
        else:
            flash("Incorrect current password.", "danger")
    finally:
        if cur: cur.close()
        if conn.is_connected(): conn.close()

    return redirect(url_for('my_profile_page'))

@app.route('/logout')
def logout():
    session.clear()
    flash("You have been successfully logged out.", "info")
    return redirect(url_for('landing_page'))

@app.route('/auth', methods=['POST'])
def auth_handler():
    if 'user_id' in session:
        return redirect(url_for('home'))

    # If we reach here, user is NOT logged in.
    if request.method == 'POST':
        form_type = request.form.get('form_type')
        conn = get_db_connection()
        if not conn:
            flash("Database connection failed.", "danger")
            return redirect(url_for('landing_page'))
        else:
            cur = None
            try:
                if form_type == 'signup':
                    fullname = request.form.get('signup-name', '').strip()
                    email = request.form.get('signup-email', '').strip().lower()
                    contact = request.form.get('signup-contact', '').strip()
                    address = request.form.get('signup-address', '').strip()
                    dob = request.form.get('signup-dob') # Get date of birth
                    password = request.form.get('signup-password', '')
                    confirm = request.form.get('signup-confirm-password', '')                    

                    if not all([fullname, email, contact, address, dob, password, confirm]):
                        flash("Please fill out all fields.", "warning")
                    elif password != confirm:
                        flash("Passwords do not match.", "warning")
                    else:
                        cur = conn.cursor()
                        cur.execute("SELECT user_id FROM profile WHERE email=%s", (email,))
                        if cur.fetchone():
                            flash("An account with this email already exists.", "warning")
                        else:
                            hashed = generate_password_hash(password)
                            cur.execute("INSERT INTO profile (username, email, password) VALUES (%s, %s, %s)", (fullname, email, hashed))
                            profile_id = cur.lastrowid
                            # Convert empty string to None for dob
                            dob_to_insert = dob if dob else None
                            cur.execute("INSERT INTO user_details (profile_id, name, contact, dob, address_line1) VALUES (%s, %s, %s, %s, %s)", (profile_id, fullname, contact, dob_to_insert, address))
                            conn.commit()
                            flash("Signup successful! You can now log in.", "success")
                            return redirect(url_for('landing_page'))

                elif form_type == 'login':
                    identifier = request.form.get('login-identifier', '').strip()
                    password = request.form.get('login-password', '')
                    if not identifier or not password:
                        flash("Please enter your credentials.", "warning")
                    else:
                        cur = conn.cursor(dictionary=True)
                        cur.execute("""
                            SELECT p.user_id, p.username, p.password, d.profile_picture_url
                            FROM profile p LEFT JOIN user_details d ON p.user_id = d.profile_id
                            WHERE (p.email=%s OR d.contact=%s) AND p.password IS NOT NULL
                        """, (identifier, identifier))
                        user = cur.fetchone()

                        if user and check_password_hash(user['password'], password):
                            session['user_id'] = user['user_id']
                            session['username'] = user['username']
                            session['profile_pic_url'] = user.get('profile_picture_url') or 'uploads/profile_pics/default-avatar.png'
                            flash(f"Welcome, {user['username']}!", "success") 

                            # Merge session cart with DB cart
                            session_cart = session.get('cart', {})
                            if session_cart:
                                try:
                                    merge_cur = conn.cursor()
                                    merge_data = []
                                    for product_id, quantity in session_cart.items():
                                        merge_data.append((user['user_id'], int(product_id), quantity, quantity))
                                    
                                    merge_query = """
                                        INSERT INTO cart_items (user_id, product_id, quantity)
                                        VALUES (%s, %s, %s)
                                        ON DUPLICATE KEY UPDATE quantity = quantity + %s
                                    """
                                    merge_cur.executemany(merge_query, merge_data)
                                    conn.commit()
                                    session.pop('cart', None) # Clear session cart after merging
                                    flash("Your guest cart has been merged.", "info")
                                except Error as merge_e:
                                    conn.rollback()
                                    print(f"DB error merging cart: {merge_e}")
                                finally:
                                    if merge_cur: merge_cur.close()
                            return redirect(url_for('my_profile_page'))
                        else:
                            flash("Invalid credentials. Please try again.", "danger")

            except Error as e:
                if conn: conn.rollback()
                print(f"DB error on {form_type}:", e)
                flash("A database error occurred.", "danger")
            finally:
                if cur: cur.close()
                if conn and conn.is_connected(): conn.close()
    
    # For GET requests, or if POST fails validation/db checks without redirecting
    return redirect(url_for('landing_page')) # Redirect back if something goes wrong

@app.route('/login/<provider>')
def social_login(provider):
    redirect_uri = url_for(f'authorize', provider=provider, _external=True)
    return getattr(oauth, provider).authorize_redirect(redirect_uri)

@app.route('/authorize/<provider>')
def authorize(provider):
    try:
        token = getattr(oauth, provider).authorize_access_token()
        if provider == 'google':
            user_info = oauth.google.userinfo(token=token)
            email = user_info.get('email')
            name = user_info.get('name')
            picture = user_info.get('picture')
        elif provider == 'facebook':
            user_info = oauth.facebook.get('me?fields=id,name,email,picture{url}').json()
            email = user_info.get('email')
            name = user_info.get('name')
            picture = user_info.get('picture', {}).get('data', {}).get('url')
        else:
            flash("Unsupported provider.", "danger")
            return redirect(url_for('landing_page'))

        if not email:
            flash("Could not retrieve email from provider. Please try a different login method.", "danger")
            return redirect(url_for('landing_page'))

        return process_social_login(email, name, picture)

    except Exception as e:
        print(f"OAuth Error with {provider}: {e}")
        flash(f"An error occurred during authentication with {provider.capitalize()}. Please try again.", "danger")
        return redirect(url_for('landing_page'))

def process_social_login(email, name, picture_url):
    conn = get_db_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for('landing_page'))

    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute("SELECT p.user_id, p.username, d.profile_picture_url FROM profile p LEFT JOIN user_details d ON p.user_id = d.profile_id WHERE p.email = %s", (email,))
            user = cur.fetchone()

            if user: # User exists, log them in
                user_id = user['user_id']
            else: # User does not exist, create a new one
                # Insert into profile (password is NULL for OAuth users)
                cur.execute("INSERT INTO profile (username, email) VALUES (%s, %s)", (name, email))
                user_id = cur.lastrowid
                # Insert into user_details
                cur.execute("INSERT INTO user_details (profile_id, name, profile_picture_url) VALUES (%s, %s, %s)", (user_id, name, picture_url))
                conn.commit()
                user = {'user_id': user_id, 'username': name, 'profile_picture_url': picture_url}

            # Set session
            session['user_id'] = user['user_id']
            session['username'] = user['username']
            session['profile_pic_url'] = user.get('profile_picture_url') or picture_url or 'static/uploads/profile_pics/default-avatar.png'
            flash(f"Welcome, {user['username']}!", "success") 
            return redirect(url_for('home'))

    except Error as e:
        if conn: conn.rollback()
        print(f"DB error on social login:", e)
        flash("A database error occurred during social login.", "danger") 
        return redirect(url_for('landing_page'))
    finally:
        if conn and conn.is_connected(): conn.close()


@app.route('/shop')
def shop_page():
    # Redirect to homepage which is now the main shop page
    return redirect(url_for('home'))

@app.route('/product/<int:product_id>')
def product_detail_page(product_id):
    conn = get_db_connection()
    product = None
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for('home'))
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute("SELECT * FROM products WHERE product_id = %s", (product_id,))
            product = cur.fetchone()
    finally:
        if conn.is_connected(): conn.close()
    if not product:
        flash("Product not found.", "danger")
        return redirect(url_for('home'))
        
    return render_template('product_detail.html', product=product)

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password_page():
    if request.method == 'POST':
        email = request.form.get('email')
        # In a real application, you would generate a secure token,
        # save it to the database with an expiration, and email a reset link to the user.
        # For this example, we'll just show a confirmation message.
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            cur.execute("SELECT user_id FROM profile WHERE email = %s", (email,))
            if cur.fetchone():
                flash("If an account with that email exists, a password reset link has been sent.", "success")
            else:
                flash("If an account with that email exists, a password reset link has been sent.", "success")
            cur.close()
            conn.close()
        return redirect(url_for('landing_page'))
    return render_template('forgot_password.html')

@app.route('/add-to-cart/<int:product_id>', methods=['POST'])
def add_to_cart(product_id):
    quantity = int(request.form.get('quantity', 1))
    
    if 'user_id' in session:
        # Logged-in user: update database
        user_id = session['user_id']
        conn = get_db_connection()
        if not conn:
            return jsonify(success=False, message="Database connection failed."), 500
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO cart_items (user_id, product_id, quantity)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE quantity = quantity + %s
                """, (user_id, product_id, quantity, quantity))
                conn.commit()
        except Error as e:
            return jsonify(success=False, message=str(e)), 500
        finally:
            if conn.is_connected(): conn.close()
    else:
        # Guest user: update session
        cart = session.get('cart', {})
        product_id_str = str(product_id)
        cart[product_id_str] = cart.get(product_id_str, 0) + quantity
        session['cart'] = cart

    return jsonify(success=True, message="Item added to cart!")

@app.route('/cart', methods=['GET', 'POST'])
def cart_page():
    cart_products = []
    total_price = 0
    conn = get_db_connection()

    if not conn:
        flash("Database connection failed.", "danger")
        return render_template('cart.html', cart_products=cart_products, total_price=total_price)

    try:
        with conn.cursor(dictionary=True) as cur:
            cart = {}
            if 'user_id' in session:
                # Logged-in user: fetch cart from DB
                cur.execute("SELECT product_id, quantity FROM cart_items WHERE user_id = %s", (session['user_id'],))
                for item in cur.fetchall():
                    cart[str(item['product_id'])] = item['quantity']
            else:
                # Guest user: fetch cart from session
                cart = session.get('cart', {})

            if cart:
                product_ids = list(cart.keys())
                placeholders = ','.join(['%s'] * len(product_ids))
                query = f"SELECT product_id, name, price, image, stock FROM products WHERE product_id IN ({placeholders})"
                cur.execute(query, product_ids)
                products_from_db = cur.fetchall()
                
                product_map = {str(p['product_id']): p for p in products_from_db}

                for product_id, quantity in cart.items():
                    product = product_map.get(product_id)
                    if product:
                        subtotal = product['price'] * quantity
                        cart_products.append({**product, 'quantity': quantity, 'subtotal': subtotal, 'image_url': product['image']})
                        total_price += subtotal
    except Error as e:
        flash("Could not load cart items.", "danger")
        print(f"DB Error loading cart: {e}")
    finally:
        if conn.is_connected(): conn.close()

    return render_template('cart.html', cart_products=cart_products, total_price=total_price)

@app.route('/update-cart/<int:product_id>', methods=['POST'])
@login_required # Or handle guests differently
def update_cart(product_id):
    quantity = int(request.form.get('quantity', 0))
    user_id = session['user_id']
    conn = get_db_connection()
    if not conn:
        flash("Database error.", "danger")
        return redirect(url_for('cart_page'))

    try:
        with conn.cursor() as cur:
            if quantity > 0:
                cur.execute("UPDATE cart_items SET quantity = %s WHERE user_id = %s AND product_id = %s", (quantity, user_id, product_id))
            else:
                cur.execute("DELETE FROM cart_items WHERE user_id = %s AND product_id = %s", (user_id, product_id))
            conn.commit()
            flash("Cart updated.", "success")
    except Error as e:
        conn.rollback()
        flash("Failed to update cart.", "danger")
        print(f"DB Error updating cart: {e}")
    finally:
        if conn.is_connected(): conn.close()

    return redirect(url_for('cart_page'))

@app.route('/remove-from-cart/<int:product_id>', methods=['POST'])
@login_required # Or handle guests differently
def remove_from_cart(product_id):
    user_id = session['user_id']
    conn = get_db_connection()
    if not conn:
        flash("Database error.", "danger")
        return redirect(url_for('cart_page'))
    
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM cart_items WHERE user_id = %s AND product_id = %s", (user_id, product_id))
            conn.commit()
            flash("Item removed from cart.", "success")
    except Error as e:
        conn.rollback()
        flash("Failed to remove item from cart.", "danger")
        print(f"DB Error removing from cart: {e}")
    finally:
        if conn.is_connected(): conn.close()

    return redirect(url_for('cart_page'))

@app.route('/checkout', methods=['GET', 'POST'])
@login_required
def checkout_page():
    user_id = session['user_id']
    conn = get_db_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for('cart_page'))

    # Fetch cart items from the database for the logged-in user
    cart = {}
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute("SELECT product_id, quantity FROM cart_items WHERE user_id = %s", (user_id,))
            for item in cur.fetchall():
                cart[str(item['product_id'])] = item['quantity']
    except Error as e:
        flash("Could not retrieve cart for checkout.", "danger")
        print(f"DB Error fetching cart for checkout: {e}")
        conn.close()
        return redirect(url_for('cart_page'))

    if not cart:
        flash("Your cart is empty.", "warning")
        return redirect(url_for('cart_page'))

    if request.method == 'POST':
        # This logic is triggered by the checkout.js animation
        try:
            # Calculate total price again on the backend to ensure integrity
            product_ids = list(cart.keys())
            placeholders = ','.join(['%s'] * len(product_ids))
            cur = conn.cursor(dictionary=True)
            query = f"SELECT product_id, price FROM products WHERE product_id IN ({placeholders})" # Ensure this table name is correct
            cur.execute(query, product_ids)
            products_from_db = {str(p['product_id']): p for p in cur.fetchall()}
            
            total_price = sum(products_from_db[pid]['price'] * qty for pid, qty in cart.items() if pid in products_from_db)

            # Create the order
            cur.execute(
                "INSERT INTO orders (user_id, total_amount, status, tracking_number) VALUES (%s, %s, %s, %s)",
                (user_id, total_price, 'Processing', f"LUMORA{secrets.token_hex(6).upper()}")
            )
            order_id = cur.lastrowid

            # Create order items
            order_items_data = [
                (order_id, pid, qty, products_from_db[pid]['price'])
                for pid, qty in cart.items() if pid in products_from_db
            ]
            cur.executemany("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (%s, %s, %s, %s)", order_items_data)

            # Clear the user's cart from the database
            cur.execute("DELETE FROM cart_items WHERE user_id = %s", (user_id,))
            conn.commit()

            flash("Order placed successfully!", "success") 
            return redirect(url_for('order_detail_page', order_id=order_id))
        except Error as e:
            if conn: conn.rollback()
            flash(f"An error occurred while placing your order: {e}", "danger")
            return redirect(url_for('cart_page'))
        finally:
            if conn.is_connected(): conn.close()

    # --- GET request logic ---
    # Fetch data to display on the checkout page
    cart_products = []
    total_price = 0
    user_data = None
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor(dictionary=True) as cur:
                # Fetch user data to pre-populate the form
                cur.execute("SELECT p.email, d.* FROM profile p LEFT JOIN user_details d ON p.user_id = d.profile_id WHERE p.user_id = %s", (session['user_id'],))
                user_data = cur.fetchone()
    
                if cart:
                    # Fetch product details to calculate the total price for display
                    product_ids = list(cart.keys())
                    placeholders = ','.join(['%s'] * len(product_ids))
                    query = f"SELECT product_id, name, price, image FROM products WHERE product_id IN ({placeholders})"
                    cur.execute(query, product_ids)
                    products_from_db = {str(p['product_id']): p for p in cur.fetchall()}
                    
                    total_price = sum(products_from_db[pid]['price'] * qty for pid, qty in cart.items() if pid in products_from_db)    
        finally:
            if conn.is_connected(): conn.close()

    return render_template('checkout.html', total_price=total_price, user=user_data)

@app.route('/my-orders')
@login_required
def my_orders_page():
    user_id = session['user_id']
    conn = get_db_connection()
    orders = []
    if conn:
        try:
            with conn.cursor(dictionary=True) as cur:
                cur.execute("SELECT * FROM orders WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
                orders = cur.fetchall()
        except Error as e:
            flash(f"Could not retrieve your orders: {e}", "danger")
        finally:
            if conn.is_connected(): conn.close()
    return render_template('my_orders.html') # The new template uses JS to render orders

@app.route('/order/<int:order_id>')
@login_required
def order_detail_page(order_id):
    user_id = session['user_id']
    conn = get_db_connection()
    order = None
    if conn:
        try:
            with conn.cursor(dictionary=True) as cur:
                cur.execute("SELECT * FROM orders WHERE order_id = %s AND user_id = %s", (order_id, user_id))
                order = cur.fetchone()
                if order:
                    cur.execute("""
                        SELECT oi.quantity, oi.price, p.name, p.image_url, p.product_id
                        FROM order_items oi JOIN products p ON oi.product_id = p.product_id 
                        WHERE oi.order_id = %s
                    """, (order_id,))
                    order['items'] = cur.fetchall()
        finally:
            if conn.is_connected(): conn.close()
    
    if not order:
        flash("Order not found or you do not have permission to view it.", "warning")
        return redirect(url_for('my_orders_page'))

    return render_template('order_detail.html', order=order)

@app.route('/contact', methods=['GET', 'POST'])
def contact_page():
    """Renders the contact page and handles form submission."""
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        message = request.form.get('message')

        if not all([name, email, message]):
            flash("Please fill out all fields.", "warning")
            return render_template('contact.html')

        conn = get_db_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    cur.execute("INSERT INTO contact_submissions (name, email, message) VALUES (%s, %s, %s)", (name, email, message))
                    conn.commit()
                flash("Thank you for your message! We'll get back to you soon.", "success")
                return redirect(url_for('contact_page'))
            finally:
                if conn.is_connected(): conn.close()
    return render_template('contact.html')

@app.route('/about')
def about_page():
    """Renders the about us page."""
    return render_template('about.html')

@app.route('/privacy-policy')
def privacy_policy_page():
    """Renders the privacy policy page."""
    return render_template('privacy_policy.html')

@app.route('/terms-of-service')
def terms_of_service_page():
    """Renders the terms of service page."""
    return render_template('terms_of_service.html')

@app.route('/faqs')
def faqs_page():
    """Renders the frequently asked questions page."""
    return render_template('faqs.html')

# ====================================================================
# API and Admin Routes for Canteen
# ====================================================================

@app.route('/api/canteen/menu')
def get_canteen_menu():
    """API endpoint to get all canteen menu items."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute("SELECT *, product_id as id FROM products ORDER BY product_id")
            menu_items = cur.fetchall()
            return jsonify(menu_items)
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn.is_connected(): conn.close()

@app.route('/admin/canteen-menu')
@admin_required
def admin_canteen_page():
    """Renders the admin page for managing the canteen menu."""
    return render_template('admin_canteen.html')

@app.route('/api/admin/canteen/menu', methods=['POST'])
@admin_required
def add_canteen_item():
    """API endpoint to add a new canteen menu item."""
    data = request.json
    conn = get_db_connection()
    if not conn: return jsonify(success=False, message="Database connection failed"), 500
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO products (name, category, description, price, image, stock, badge)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (data['name'], data['category'], data['description'], data['price'], data['image'], data['stock'], data.get('badge')))
            conn.commit()
            return jsonify(success=True, message="Item added successfully", id=cur.lastrowid)
    except Error as e:
        conn.rollback()
        return jsonify(success=False, message=str(e)), 500
    finally:
        if conn.is_connected(): conn.close()

@app.route('/api/admin/canteen/menu/<int:item_id>', methods=['PUT'])
@admin_required
def update_canteen_item(item_id):
    """API endpoint to update an existing canteen menu item."""
    data = request.json
    conn = get_db_connection()
    if not conn: return jsonify(success=False, message="Database connection failed"), 500
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE products SET name=%s, category=%s, description=%s, price=%s, image=%s, stock=%s, badge=%s
                WHERE product_id=%s
            """, (data['name'], data['category'], data['description'], data['price'], data['image'], data['stock'], data.get('badge'), item_id))
            conn.commit()
            return jsonify(success=True, message="Item updated successfully")
    except Error as e:
        conn.rollback()
        return jsonify(success=False, message=str(e)), 500
    finally:
        if conn.is_connected(): conn.close()

@app.route('/api/admin/canteen/menu/<int:item_id>', methods=['DELETE'])
@admin_required
def delete_canteen_item(item_id):
    """API endpoint to delete a canteen menu item."""
    # This is a basic implementation. In a real-world scenario, you might want to "soft delete" (mark as inactive) instead.
    conn = get_db_connection()
    if not conn: return jsonify(success=False, message="Database connection failed"), 500
    
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM products WHERE product_id = %s", (item_id,))
            conn.commit()
            return jsonify(success=True, message="Item deleted successfully")
    except Error as e:
        conn.rollback()
        return jsonify(success=False, message=str(e)), 500
    finally:
        if conn.is_connected(): conn.close()

@app.route('/admin-login', methods=['GET', 'POST'])
def admin_login_page():
    if session.get('is_admin'):
        return redirect(url_for('admin_dashboard'))

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        # In a real app, use a secure way to store admin credentials
        if username == 'admin@lumora.com' and password == 'admin123':
            session['is_admin'] = True
            session['username'] = 'Admin' # Set a display name for the admin
            flash("Admin login successful.", "success")
            return redirect(url_for('admin_dashboard'))
        else:
            flash("Invalid admin credentials.", "danger")

    return render_template('admin-login.html')

@app.route('/admin/dashboard')
@admin_required
def admin_dashboard():
    conn = get_db_connection()
    data = {'users': []}
    if conn:
        try:
            with conn.cursor(dictionary=True) as cur:
                # Fetch users
                cur.execute("""
                    SELECT p.user_id, p.username, p.email, p.created_at, d.contact 
                    FROM profile p 
                    LEFT JOIN user_details d ON p.user_id = d.profile_id 
                    ORDER BY p.created_at DESC
                """)
                data['users'] = cur.fetchall()
        except Error as e:
            flash(f"Error fetching dashboard data: {e}", "danger")
        finally:
            if conn.is_connected(): conn.close()
    return render_template('admin_dashboard.html', data=data)

@app.route('/admin/delete-user/<int:user_id>', methods=['POST'])
@admin_required
def delete_user(user_id):
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM profile WHERE user_id = %s", (user_id,))
            conn.commit()
            flash(f"User ID {user_id} has been deleted.", "success")
        except Error as e:
            flash(f"Error deleting user: {e}", "danger")
        finally:
            conn.close()
    return redirect(url_for('admin_dashboard'))

if __name__ == "__main__":
    app.run(debug=True)
