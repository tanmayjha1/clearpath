# ClearPath

> Emergency Vehicle Priority via Pre-Emptive Lane Clearance  
> Community Safety Hackathon 2026

ClearPath is a mobile application demonstrating the core concept of 
Dispatch: an API-driven broadcast layer that delivers calm, targeted 
lane clearance advisories to civilian drivers ahead of an ambulance — 
before the siren reaches them.

Built with React Native and Expo, designed for future integration into 
Singapore's ERP 2.0 On-Board Units (OBUs).

---

## The Problem — Life vs. Latency

In dense urban road networks, ambulances lose critical seconds not 
because of vehicle capability, but because of human reaction time under 
uncertainty. Conventional sirens are reactive — drivers only know an 
ambulance is near when it is already close, triggering panic-braking, 
indecision at merges, and temporary gridlock.

Every second saved in travel time has measurable clinical impact. 
For out-of-hospital cardiac arrest (OHCA), survival probability drops 
significantly with each minute of delay. A 15% reduction in travel time 
— roughly 1.2 minutes on an 8-minute journey — can be the difference 
between life and death at scale.

---

## The Solution

Dispatch reframes this as a pre-emptive problem. Instead of alerting 
drivers when the ambulance is already adjacent, ClearPath:

1. Computes the ambulance's real road route using Google Directions API
2. Identifies civilian vehicles likely to intersect the ambulance's 
   corridor using proximity-based trajectory matching
3. Pushes calm, coordinate-specific, multilingual advisories to only 
   those drivers — not everyone nearby
4. Syncs all state in real time across devices via Supabase, 
   simulating the cloud-to-OBU broadcast architecture described in 
   the full Dispatch system design

---

## Core Features

**Google Maps Custom Routing**  
Dispatcher selects any origin and destination in Singapore using Google 
Places Autocomplete. The Directions API returns the optimal road route, 
rendered as a polyline on a live map view.

**Trajectory-Based Car Targeting**  
Civilian cars are generated near the route and move continuously. 
Every 3 seconds, the system identifies which car is nearest to the 
ambulance and on the route corridor — matching the trajectory matching 
logic described in the Dispatch system design. Only that driver receives 
an alert.

**Real-Time Supabase Synchronisation**  
Dispatcher actions — triggering a dispatch, ambulance position updates, 
nearest car changes, lane clearance confirmations — propagate instantly 
to all connected devices via Supabase real-time channels. This mirrors 
the Message Broker component in the Dispatch cloud architecture.

**Device Identity Selector**  
Each device selects a role on first launch: Dispatcher or Driver (Car A 
through E). Role and car ID are persisted via AsyncStorage. This enables 
multi-device demos where different drivers receive alerts as the 
ambulance progresses along its route.

**Multilingual AI Alerts**  
When a driver is identified as nearest to the ambulance, ClearPath calls 
the OpenAI API to generate a calm, localised driving instruction in the 
driver's preferred language. Supported languages: English, Mandarin, 
Malay, and Tamil — reflecting Singapore's four official languages and 
the equitable access principle in the Dispatch responsible design model.

---

## Architecture
```
Dispatcher Device          Supabase (Cloud)         Driver Device(s)
─────────────────          ────────────────          ─────────────────
Google Places         →    dispatches table    →     Real-time listener
Directions API        →    active_vehicles     →     Nearest car check
Ambulance animation        (real-time sync)          Alert UI trigger
Car simulation        →    position updates    →     Lane cleared sync
```

This prototype implements the following Dispatch cloud components:

| Dispatch Component     | ClearPath Implementation              |
|------------------------|---------------------------------------|
| Telemetry Ingest       | Ambulance marker animated along route |
| Corridor Engine        | isLocationOnEdge() 300m buffer        |
| Targeting              | Nearest car detection every 3 seconds |
| Message Broker         | Supabase real-time channels           |
| OBU Advisory Display   | Driver screen alert UI                |
| Anonymisation          | Car IDs only, no driver identity      |

---

## Privacy Model

Following the Dispatch push-only, anonymised design principle:

- No driver identity is collected or stored
- Only car IDs and positions during an active dispatch are written 
  to Supabase
- All dispatch rows and vehicle records are scoped to a single 
  session and can be cleared on resolve
- Advisories are targeted — only corridor-intersecting vehicles 
  receive alerts, reducing unnecessary data exposure

---

## Development Setup

The app runs on Expo.

**1. Install dependencies**
```bash
npm install
```

**2. Configure environment keys**  
Create a `.env` file at the project root:
```
EXPO_PUBLIC_GOOGLE_MAPS_KEY=your_google_maps_key
EXPO_PUBLIC_OPENAI_KEY=your_openai_key
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

See `.env.example` for reference. Never commit your `.env` file.

**3. Database setup**  
Run the following SQL scripts in your Supabase SQL Editor:
- `active_vehicles_setup.sql`
- `dispatches_setup.sql`

**4. Start the app**
```bash
npx expo start
```

Scan the QR code with Expo Go on your device.

---

## Multi-Device Demo

For the best demonstration, use 3 devices:

| Device | Role | Setup |
|--------|------|-------|
| Device 1 | Dispatcher | Select Dispatcher on launch |
| Device 2 | Driver A | Select Driver → Car A |
| Device 3 | Driver B | Select Driver → Car B |

Trigger a dispatch on Device 1. As the ambulance moves along the route, 
alerts will shift between Driver devices based on proximity. Each driver 
confirms lane clearance independently.

---

## Limitations and Future Work

This prototype demonstrates the core targeting and advisory logic. 
The full Dispatch system design includes:

- **Dead reckoning** for GNSS/connectivity dead zones (tunnels, 
  underpasses) — not yet implemented
- **Blocked car edge case handling** — advisory suppression and 
  upstream rerouting when a vehicle cannot manoeuvre
- **V2I Green Wave integration** — signal pre-emption on ambulance 
  approach
- **SUMO/CityFlow simulation validation** — formal metrics on travel 
  time delta, alert precision, and safety proxies
- **ERP 2.0 OBU integration** — replacing the mobile app with direct 
  OBU firmware integration via LTA's ERP 2.0 infrastructure

---

## References

- LTA ERP 2.0 OBU Overview
- AHA Circulation — resuscitation timing and survival evidence
- Singapore OHCA Survival Review (PMC)

Full references in `Dispatch_Project_Documentation.pdf`
