# Dynamic Micro-Tender Platform 🏛️🚀

An AI-augmented civic maintenance and micro-tender generation platform. This system automates the process of converting citizen complaints into actionable micro-tenders, matching them with local vendors, and providing real-time tracking.

## 🌟 Key Features

- **AI-Driven Cost Estimation**: Automatically calculates project costs based on issue type and severity.
- **Geospatial Vendor Matching**: Uses Haversine formula to find the nearest qualified vendors.
- **Real-time Notifications**: Integrated with Socket.IO for instant updates on bids and tender status.
- **Anti-Fraud Mechanisms**: Built-in verification for citizen complaints and vendor bids.
- **Interactive Map Dashboard**: Visualize issues and tenders in real-time using Leaflet/Mapbox.
- **Full-Stack Security**: JWT-based authentication for Citizens, Vendors, and Admins.

## 🛠️ Tech Stack

- **Frontend**: React.js, Tailwind CSS, Vite, Socket.IO Client, Leaflet.
- **Backend**: Node.js, Express.js, Socket.IO, SQLite3.
- **AI/Logic**: Custom rule-based cost estimation and location matching algorithms.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/trycode277/Dynamic-Micro-tender.git
   cd Dynamic-Micro-tender
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   npm start
   ```

3. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

## 📂 Project Structure

- `backend/`: Express server, SQLite database, and business logic.
- `frontend/`: React application with modern UI/UX components.

## 📝 License

MIT
