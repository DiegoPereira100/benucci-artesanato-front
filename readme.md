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
├── app/                 # Application screens and routing
│   ├── (tabs)/         # Tab-based navigation screens
│   │   ├── _layout.tsx # Tab layout configuration
│   │   ├── explore.tsx # Explore/catalog screen
│   │   ├── home.tsx    # Home screen
│   │   ├── profile.tsx # User profile screen
│   │   └── settings.tsx# App settings screen
│   ├── auth/           # Authentication screens
│   │   ├── _layout.tsx # Auth layout
│   │   ├── login.tsx   # Login screen
│   │   └── register.tsx# Registration screen
│   ├── _layout.tsx     # Root layout
│   └── index.tsx       # App entry point
├── assets/             # Static assets (images, fonts, icons)
├── src/                # Source code
│   ├── components/     # Reusable UI components
│   │   ├── forms/      # Form-specific components
│   │   ├── navigation/ # Navigation components
│   │   └── ui/         # Generic UI components
│   ├── constants/      # App constants and configuration
│   ├── hooks/          # Custom React hooks
│   │   └── useAuth.tsx # Authentication hook
│   ├── services/       # API integration layer
│   │   ├── api.ts      # Axios configuration
│   │   └── auth.ts     # Authentication services
│   ├── types/          # TypeScript type definitions
│   │   ├── auth.ts     # Authentication types
│   │   └── env.ts      # Environment types
│   └── utils/          # Utility functions
├── build/              # Build output directory
└── node_modules/       # Dependencies
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

3. **Configure environment variables**
   
   Create a `.env` file in the root directory and add the following variables:

   ```env
   # API Configuration
   API_BASE_URL=http://000.000.0.100:8080
   API_TIMEOUT=20000
   ENABLE_DEBUG=true
   ```

   **Environment Variables Explained:**

   | Variable | Description | Default | Required |
   |----------|-------------|---------|----------|
   | `API_BASE_URL` | Base URL for the backend API server | - | ✅ Yes |
   | `API_TIMEOUT` | Request timeout in milliseconds | `20000` | ❌ No |
   | `ENABLE_DEBUG` | Enable debug mode for development | `false` | ❌ No |

   > **Note**: Replace `000.000.0.100` with your actual backend server IP address or domain.

4. **Start the development server**
   ```bash
   npx expo start
   ```

5. **Run on device/emulator**
   - **Physical Device**: Install [Expo Go](https://expo.dev/client) and scan the QR code
   - **iOS Simulator**: Press `i` in the terminal
   - **Android Emulator**: Press `a` in the terminal

### Development Tips

- **Local Development**: For local development, use your machine's local IP address instead of `localhost` in `API_BASE_URL`
- **Production**: Update the `API_BASE_URL` to your production server URL before building
- **Debug Mode**: Set `ENABLE_DEBUG=false` in production for better performance

## 🔗 Related Projects

- **Backend API**: [Benucci Artesanato Backend](https://github.com/GlhermePereira/Benucci-Artesanato)