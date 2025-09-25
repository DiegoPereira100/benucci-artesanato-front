# Benucci Artesanato - Frontend

[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB?logo=react&logoColor=white)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-5.0-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-In%20Development-FFA500)](https://github.com/DiegoPereira100/benucci-artesanato-frontend)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

> A modern React Native mobile application for Benucci Artesanato, providing a seamless digital catalog experience for artisanal products.

## 📖 Overview

Benucci Artesanato Frontend is a cross-platform mobile application built with React Native and Expo. It serves as the client-side interface for the Benucci Artesanato e-commerce platform, offering customers an intuitive way to browse and purchase handcrafted products.

The app connects to our [backend API](https://github.com/GlhermePereira/Benucci-Artesanato) to provide real-time product information, inventory management, and seamless user experience.

## Problem Statement

Traditional artisan businesses face significant challenges in the digital marketplace:

- **Limited Reach**: Physical store constraints restrict customer base expansion
- **Inventory Visibility**: Customers lack real-time product availability information  
- **Market Intelligence**: Difficulty predicting seasonal demand patterns (holidays, special occasions)
- **Customer Experience**: Limited browsing and purchasing options outside store hours

## Solution

Our mobile application addresses these challenges by providing:

- **📱 Real-time Digital Catalog**: Live inventory with instant updates
- **🏷️ Intelligent Categorization**: Smart product classification by categories, themes, and popularity
- **🌍 Market Expansion**: Reach customers beyond geographical limitations
- **⚡ Enhanced UX**: Streamlined shopping experience with modern mobile interface
- **📊 Analytics Ready**: Foundation for business intelligence and demand forecasting

## Tech Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| [React Native](https://reactnative.dev/) | Mobile Framework | 0.76 |
| [Expo](https://expo.dev/) | Development Platform | 5.0 |
| [Expo Router](https://expo.github.io/router/) | File-based Navigation | Latest |
| [TypeScript](https://www.typescriptlang.org/) | Type Safety | 5.0+ |
| [React Navigation](https://reactnavigation.org/) | Navigation | 6.x |
| [Axios](https://axios-http.com/) | HTTP Client | Latest |
| [Styled Components](https://styled-components.com/) | Styling Solution | Latest |

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Generic components
│   ├── forms/          # Form-specific components
│   └── navigation/     # Navigation components
├── screens/            # Application screens
│   ├── auth/          # Authentication screens
│   ├── catalog/       # Product catalog screens
│   └── profile/       # User profile screens
├── services/          # API integration layer
│   ├── api.js         # Axios configuration
│   └── endpoints/     # API endpoint definitions
├── utils/             # Utility functions
├── hooks/             # Custom React hooks
├── types/             # TypeScript type definitions
└── assets/            # Static assets (images, fonts)
```

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator or Android Emulator (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone git@github.com:DiegoPereira100/benucci-artesanato-frontend.git
   cd benucci-artesanato-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start the development server**
   ```bash
   npx expo start
   ```

4. **Run on device/emulator**
   - **Physical Device**: Install [Expo Go](https://expo.dev/client) and scan the QR code
   - **iOS Simulator**: Press `i` in the terminal
   - **Android Emulator**: Press `a` in the terminal

### Environment Configuration

Create a `.env` file in the root directory:

```env
API_BASE_URL=https://your-backend-api.com
EXPO_PUBLIC_API_KEY=your_api_key_here
```

## 🔗 Related Projects

- **Backend API**: [Benucci Artesanato Backend](https://github.com/GlhermePereira/Benucci-Artesanato)
