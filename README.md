# ClearPath — React Native Mobile App

ClearPath is a mobile application to be later integrated into OBUs built with React Native and Expo that simulates an incoming emergency response vehicle, alerting civilian drivers in its path.

## Core Features

- **Google Maps Custom Routing**: Dispatcher can View and pick origins/destinations anywhere in Singapore using Google Places Autocomplete. Renders immediate routes via the Directions API on a Google Map view.
- **Realistic Car Simulation**: Calculates movement and simulated coordinates for multiple "civilian cars" near the ambulance's route path, visually indicating proximity via colored markers.
- **Real-Time Supabase Synchronization**: Dispatcher map actions simultaneously synchronize civilian car statuses (`is_nearest`, `has_cleared`) and ambulance paths across multiple devices via Supabase real-time channels.
- **Device Roles (Identity Selector)**: Choose to act as the Dispatcher or a simulated Civilian Driver. Driver state is seamlessly preserved using `AsyncStorage`.
- **Multi-Language AI Alerts**: Distributes customized, multilingual alert summaries. Supported languages include English, Mandarin, Malay, and Tamil. When the driver is the nearest on-route to the emergy responder vehicle, ClearPath calls OpenAI API to synthesize an immediate, calm local language driving instruction: _"Move to the left lane as emergency responders are coming on the right lane. Maintain a safe distance as they approach."_

## Development Setup

The app runs on Expo. To test or build the app:

1. **Install Modules**: `npm install`
2. **Environment Keys**: You must configure an `.env` file at the root of the project with the following inputs:
   - `EXPO_PUBLIC_GOOGLE_MAPS_KEY`
   - `EXPO_PUBLIC_OPENAI_KEY`
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. **Database Setup**: Execute the setup scripts (like `active_vehicles_setup.sql` and previous dispatches setup) inside your Supabase SQL Editor.
4. **Boot App**: `npx expo start`
