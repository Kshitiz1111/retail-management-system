# 🏗️ Master Architecture Blueprint: Retail Management System (Enterprise Resource Planning) and POS (Point of Sale) system

## 1. Core Architecture Strategy

To ensure the system is "feature-rich but easy to operate," we will decouple the logic from the UI using a **Service Layer Pattern**.

### **A. The Service Layer (Abstraction)**

You mentioned using ImgBB now but S3 later. We will solve this by creating Interface-like service wrappers.

* **Logic:** You never call `imgbb.upload()` directly in your components.
* **Implementation:** You create a file `services/imageService.ts`.
* **Current Version:** The function `uploadImage(file)` sends data to ImgBB.
* **Future Version:** You rewrite `uploadImage(file)` to send to AWS S3. The rest of your app (Inventory, POS) never needs to change.



### **B. Role-Based Access Control (RBAC)**

We will use **Firebase Custom Claims**.

* **Admin:** Full access (Finance, Settings, Staff Management).
* **Manager:** Inventory & Sales, no Finance access.
* **Staff:** POS (Sales) only.
* **Customer:** Public store & Profile only.

### **C. The "Future-Proof" Hardware Logic**

* **Web APIs:** We will abstract printing into a `PrinterProvider` context that checks availability of `navigator.usb`, `navigator.bluetooth`, or `navigator.serial`.
* **Scanner Integration:** Standard barcode scanners act as keyboards. We will build a global `useBarcodeScanner` hook that listens for rapid keypresses ending in `Enter` (standard barcode behavior) to auto-add items to the cart anywhere in the POS.

---

## 📅 Phase 1: The "Brain" (Admin & POS Platform)

This phase builds the internal tools your staff will use daily.

### **Module 1: Authentication & Role Management**

1. **Strict Sign-up:** Disable public sign-up for Admin/Staff. Admins create Staff accounts from the dashboard.
2. **Email Verification:** Force `sendEmailVerification` on Firebase user creation. Block login until `emailVerified` is true.
3. **Role Assignment UI:** A simple table where Admin selects a user and assigns a role. This triggers a Firebase Cloud Function to set the `customClaim`.

### **Module 2: Advanced Inventory (The "Warehouse")**

We need a schema that supports your "Locate Item" feature.

* **Data Structure:**
```typescript
type Product = {
   id: string;
   sku: string; // The text inside the QR Code
   name: string;
   warehouses: {
      [warehouseId: string]: {
         quantity: number;
         position: string; // e.g., "Row A - Shelf 2"
      }
   };
   trackTrace: {
      qrCodeUrl: string; // Generated on creation
      history: Log[]; // "Moved from Shelf A to B by User X"
   }
}

```


* **QR Generation:** On product creation, generate a unique ID. Use `react-qr-code` to render it. The content of the QR should be a JSON string: `{"type":"item", "id":"123"}` so your scanner knows what it just scanned.

### **Module 3: The POS Terminal (Point of Sale)**

This is the heart of the daily operation.

* **Interface:** A split screen. Left side = Cart. Right side = Grid of products (with Search).
* **Smart Search:** Implement `Fuse.js` for fuzzy searching (e.g., searching "mixxr" finds "Mixer").
* **Hardware Integration (WebUSB/Serial):**
* We will implement a **"Connect Printer"** settings page.
* Using the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API), we can send ESC/POS commands directly to thermal printers without needing print drivers installed on the OS.
* web usb and web bluetooth api. apply printing que management. setup printer page.



### **Module 4: Dynamic Loyalty Engine**

Instead of hardcoding, we store the "Rules" in Firestore.

* **Rule Schema:**
```json
{
  "earnRate": 0.001, // Spend 1000, get 1 token (1000 * 0.001)
  "redeemRate": 10,   // 1 Token = 10 Rupees Discount (or %)
  "minPointsToRedeem": 10
}

```


* **POS Calculation:** When adding a customer to the sale, the POS fetches these rules, calculates potential points, and displays: *"Customer has 50 points. Redeem for 500 Rs discount?"*

### **Module 5: Finance & Reports**

* **Day Book:** A real-time collection of all `transactions` for the day.
* **Staff Performance:** Track who sold what.

---

## 📅 Phase 2: The "Face" (Customer Platform)

### **Module 1: The Storefront**

* **Next.js Features:** Use **Static Site Generation (SSG)** for product pages to ensure they load instantly and rank high on Google.
* **Search & Filter:** Re-use the "Smart Search" logic but styled for customers (Grid view with large images).

### **Module 2: Customer Loyalty Experience**

* **Dashboard:** When a customer logs in, show a "Loyalty Card" UI component showing their progress bar to the next reward.
* **Checkout:** If they are logged in, apply the "Earn Logic" automatically.

### **Module 3: Purchase Flow (COD Only)**

* **Simple Checkout:** Cart -> Address (Auto-fill if saved) -> Confirm Order.
* **Verification:** Optional: Send an OTP or Email to confirm the COD order to prevent fake orders.

---

## 🚀 Technical Implementation Details (The "How-To")

### 1. The Image Abstraction Layer (Code Plan)

Create `src/lib/services/storage.ts`:

```typescript
// This interface forces us to stick to one method, regardless of the provider
interface StorageService {
  upload(file: File, path: string): Promise<string>; // Returns URL
  delete(url: string): Promise<void>;
}

// ImgBB Implementation
export const imgbbService: StorageService = {
  upload: async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    // Call ImgBB API...
    return "https://i.ibb.co/..."
  },
  delete: async (url) => {
    // ImgBB doesn't easily support delete via API without heavy setup
    // We can leave this empty or log a warning for now
  }
}

// Future S3 Implementation (You just swap the export later)
export const s3Service: StorageService = { ... }

```

### 2. The Advanced Printer Hook (Web Serial/USB)

Printing to thermal printers is tricky. We need a hook to manage the connection.

```typescript
// src/hooks/useThermalPrinter.ts
export function useThermalPrinter() {
  const [port, setPort] = useState<SerialPort | null>(null);

  const connect = async () => {
    // Request user to select a printer via USB/Serial
    const p = await navigator.serial.requestPort();
    await p.open({ baudRate: 9600 });
    setPort(p);
  };

  const printReceipt = async (receiptData: string) => {
    if (!port) return;
    const writer = port.writable.getWriter();
    // Convert receipt text to Uint8Array (ESC/POS commands)
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(receiptData));
    writer.releaseLock();
  };

  return { connect, printReceipt };
}

```

### 3. The "Smart Scanning" Future Feature

You asked about a device that scans and opens details on a PC.
**Solution: "Firestore Listeners as Signaling"**

1. **The PC (Admin):** Opens the "Active Scanner" page. It listens to a Firestore document: `scans/active_session`.
2. **The Mobile (Staff):** Logs in and opens "Scanner Mode".
3. **The Action:**
* Staff scans a QR code with the mobile camera.
* Mobile app writes `{ sku: "123", timestamp: "..." }` to `scans/active_session`.


4. **The Reaction:**
* The PC detects the database change instantly (using `onSnapshot`).
* The PC fetches item "123" and displays the details on the big screen automatically.
* *Result:* Seamless "Magic" integration without Bluetooth.



---

## 🏁 Step-by-Step Execution Plan

### **Step 1: Foundation**

* Initialize Next.js project with your specific `package.json`.
* Setup Firebase (Auth + Firestore).
* Create the `User` context and `StorageService` abstraction.
* **Result:** A blank app where users can login and roles are recognized.

### **Step 2: Inventory & Admin**

* Build the "Add Product" form (with Image Upload & QR generation).
* Build the Product List table with Search.
* **Result:** You can fill your digital warehouse.

### **Step 3: POS & Hardware**

* Build the POS Interface.
* Integrate the Barcode Scanner (Keyboard listener).
* Integrate Web Serial API for thermal printing.
* **Result:** You can sell items and print receipts.

### **Step 4: Customer Site & Loyalty**

* Build the public facing pages.
* Implement the Loyalty Token logic engine.
* **Result:** Customers can browse and order.

### **Step 5: Testing & Deployment (Day 25+)**

* Test Role permissions (Can a staff member delete a product? They shouldn't be able to).
* Deploy to Vercel (Next.js native host).

---

### 💡 Recommendation for "Best Platform" Status

1. **"Offline First" Architecture:** Retail shops often lose internet. Use **Firestore Offline Persistence**. This allows your POS to continue selling and printing receipts even if the internet cuts out. It will sync data when the internet returns.
2. **Visual Planograms:** Since you track "Bin/Shelf" locations, eventually build a visual map of your store in the Admin dashboard. Clicking "Shelf A" shows what items are physically there.

Would you like to start with **Step 1 (Project Setup & Auth Configuration)**? I can provide the exact `firebase.ts` config and the **Role-Based Middleware** code for Next.js 16.

You are absolutely right. I focused too much on the "Core" structure and glossed over the specific, heavy-lifting features you asked for like **Accounting, Employee Finance, Vendor Management, and the specific "Magic" Scanner workflow.**

To build a **complete ERP**, we cannot just "add fields." We need specific logic flows. Here is the detailed technical breakdown for the missing features to complete your platform.

---

### 1. Finance & Accounting Management (The "Ledger" System)

Retail accounting is tricky because you need to track cash, profit, and expenses simultaneously. We will implement a **Double-Entry Lite** system.

**The Logic:**
Every money movement is a `Transaction`. We don't just update a "Total Cash" field; we record a row.

**Data Model (`/finance_ledger`):**

```typescript
type LedgerEntry = {
  id: string;
  date: Timestamp;
  type: 'INCOME' | 'EXPENSE' | 'ASSET' | 'LIABILITY';
  category: 'SALES' | 'PURCHASE' | 'SALARY' | 'RENT' | 'UTILITY' | 'VENDOR_PAY';
  amount: number;
  description: string; // e.g., "Sold 2 Rice Cookers" or "Paid Nepal Electric"
  relatedId?: string; // ID of the Order, Employee, or Vendor
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'FONE_PAY';
  performedBy: string; // User ID of staff
}

```

**Features to Build:**

* **Auto-Posting:** When a sale happens in POS, the system *automatically* creates a `type: 'INCOME', category: 'SALES'` entry. No manual work.
* **Daily P&L Report:** A function that sums all `INCOME` and subtracts all `EXPENSE` for the current date to show "Today's Net Profit."
* **Petty Cash Tracking:** If staff takes 500 Rs for tea, they hit "Add Expense" -> "Tea/Coffee". It deducts from the drawer cash count immediately.

### 2. Employee Management & HR Finance

You need to manage not just *who* they are, but their money (Advances, Salaries).

**Data Model (`/employees`):**

```typescript
type EmployeeProfile = {
  uid: string; // Linked to Firebase Auth
  role: 'admin' | 'manager' | 'staff';
  baseSalary: number; // e.g., 25000
  joiningDate: Timestamp;
  status: 'ACTIVE' | 'ON_LEAVE';
  finance: {
    currentAdvance: number; // Money they took before payday
    unpaidCommissions: number; // If they earn % on sales
  }
}

```

**Data Model (`/attendance`):**

```typescript
type AttendanceRecord = {
  uid: string;
  date: string; // "2024-05-20"
  checkIn: Timestamp;
  checkOut?: Timestamp;
  totalHours: number;
}

```

**Features to Build:**

* **Salary Slip Generator:** On month-end, a function runs: `(Base Salary / 30 * Days Present) + Commissions - Advances`.
* **Advance Request:** Staff can click "Request Advance." Admin approves it. This creates a `LedgerEntry` (Expense) and updates `currentAdvance`.

### 3. Vendor Management (Procurement)

This is how you get stock *into* the warehouse.

**Data Model (`/vendors`):**

```typescript
type Vendor = {
  id: string;
  companyName: string; // e.g., "Alpha Electronics Pvt Ltd"
  contactPerson: string;
  phone: string;
  balance: number; // How much we owe them (Accounts Payable)
}

```

**The Procurement Flow (Logic):**

1. **Create PO (Purchase Order):** Admin selects items to buy. Status: `PENDING`.
2. **GRN (Goods Received Note):** When the truck arrives, staff checks the items.
* *System Action 1:* Updates Inventory (`+` Quantity).
* *System Action 2:* Updates Vendor Balance (`+` Amount Owed).
* *System Action 3:* Generates barcode labels for new items immediately.



### 4. Advanced Printing (WebUSB, BLE, Serial)

To support **all** printers (Bluetooth, USB, Serial) directly from the browser without drivers, we need a "Printer Adapter" pattern.

**Implementation Plan:**
We will use a library approach (like `web-thermal-printer-client` logic) but built custom for React.

* **The "Printer Settings" Page:**
* Dropdown: *Select Interface (USB / Serial / Bluetooth)*
* Button: *Pair Device* (Triggers the browser's native permission popup).


* **The Code Strategy (The Interface):**

```typescript
// interface definition
interface PrinterAdapter {
  connect(): Promise<void>;
  print(data: Uint8Array): Promise<void>;
}

// 1. Web Serial Adapter (Best for USB Thermal Printers)
class SerialPrinter implements PrinterAdapter {
  async connect() {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    // Save writer to state...
  }
  // ...
}

// 2. Web Bluetooth Adapter (Best for Portable Mobile Printers)
class BluetoothPrinter implements PrinterAdapter {
  async connect() {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }] // Standard Printer Service UUID
    });
    // Connect to GATT server...
  }
}

```

### 5. The "Magic" Scan-to-PC Feature

You asked for a feature where a user scans a QR on a device, and it opens on the PC.

**The Workflow:**

1. **Staff on PC:** Opens the "Sales Dashboard." The PC subscribes to a specific Firestore document: `sessions/{storeId}/activeScan`.
2. **Staff on Mobile:** Walks around the store. Sees a "Rice Cooker." Scans the QR code using the mobile web app.
3. **The Trigger:** The mobile app updates the `activeScan` document with `{ productId: "123", action: "SHOW_DETAILS" }`.
4. **The Result:** The PC, listening to that document, instantly pops up the "Rice Cooker" details overlay.
5. **Add to Cart:** Staff taps "Add to Cart" on the **Mobile**. The PC Cart updates instantly (because both listen to the same `cart` collection).

### 6. Admin Dashboard & Role Assignment

* **Dashboard Widgets:**
* *Low Stock Alert:* Table showing items where `qty < minQty`.
* *Top Selling Items:* Chart.
* *Pending Orders:* (If you have online orders).


* **Role Management:**
* **Admin:** Has access to `/admin/finance`, `/admin/employees`.
* **Manager:** Has access to `/admin/inventory`, `/admin/vendors`.
* **Staff:** Can only access `/pos` and `/profile`.
* *Security:* We implement this using Next.js Middleware (`middleware.ts`) to check Custom Claims before rendering the page.



### 7. Customer Site Specifics

* **Loyalty System (Dynamic):**
* When a user checkouts, a **Cloud Function** triggers.
* It reads the `LoyaltyRules` from Firestore.
* It updates the user's `loyaltyPoints` balance.


* **Filter System:**
* We will use **Facet Filtering**.
* Store attributes as a map: `attributes: { "wattage": "500W", "material": "steel" }`.
* This allows dynamic filters on the frontend based on category.



---

### Updated Execution Roadmap (Including "The Missing Pieces")

**Phase 1: The Core & Inventory**

1. Setup Next.js + Firebase.
2. Build **Role Management** (Admin assigns roles).
3. Build **Inventory** (Multi-warehouse logic).
4. **Vendor Management** (Create Vendors, Purchase Orders).

**Phase 2: The Logic (Finance & HR)**

1. Build **Ledger System** (Income/Expense recording).
2. Build **Employee System** (Attendance, Salary calc).
3. Link Inventory to Ledger (Buying stock = Expense).

**Phase 3: The Hardware & POS**

1. Build **POS UI**.
2. Implement **Web Serial / Bluetooth Printing**.
3. Implement **Mobile-to-PC Realtime Scanning**.

**Phase 4: Customer Front**

1. Build Storefront.
2. Implement **Loyalty Logic**.
3. Final Polish (SEO, Image Optimization).
