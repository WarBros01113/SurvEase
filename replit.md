# SurvEase - Form Sharing and Tracking Platform

## Overview

SurvEase is a web application for sharing, discovering, and tracking form completions. It allows users to register, login, post links to Google Forms, track completions, provide ratings and feedback, and view analytics. The application follows a client-server architecture using React for the frontend and Express for the backend, with PostgreSQL as the database.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React, using a component-based architecture with several key features:
- **Routing**: Uses `wouter` for lightweight client-side routing
- **State Management**: Combines React Context and TanStack Query for data fetching and state
- **UI Components**: Utilizes shadcn/ui components based on Radix UI primitives
- **Styling**: Implemented with Tailwind CSS including a customized design system
- **Forms**: Employs React Hook Form with Zod validation

### Backend Architecture
The backend is an Express.js server that provides RESTful API endpoints:
- **Authentication**: Uses Passport.js with local strategy and session-based auth
- **Database Access**: Implements Drizzle ORM with PostgreSQL
- **Session Management**: Employs express-session with connect-pg-simple for persistence
- **API Structure**: RESTful endpoints with JSON responses

### Data Storage
The application uses PostgreSQL for data persistence with the following schema:
- **Users**: Store user accounts and credentials
- **Forms**: Contains form metadata, URLs, and ownership information
- **Completions**: Tracks form completions with ratings and feedback

## Key Components

### Frontend Components
1. **Authentication System**
   - Login/Register forms with validation
   - Protected routes that redirect unauthenticated users
   - User context available throughout the application

2. **Form Discovery**
   - Home page with form listing and filtering
   - Search functionality by title and tags
   - Tag-based filtering

3. **Dashboard**
   - Analytics and statistics for users
   - Recent activity tracking
   - Visual charts for completion data

4. **Profile Management**
   - User profile with statistics
   - Forms created by the user
   - Completion history

5. **Form Creation**
   - Form submission with validation
   - Google Form URL validation
   - Tag management

6. **Rating System**
   - Star-based rating interface
   - Feedback collection
   - Completion tracking

### Backend Components
1. **Authentication API**
   - User registration
   - Login/logout functionality
   - Session management

2. **Forms API**
   - CRUD operations for forms
   - Filtering and search
   - Tag-based queries

3. **Completions API**
   - Track form completions
   - Store ratings and feedback
   - Generate statistics

4. **User API**
   - Profile information
   - User statistics
   - Activity tracking

## Data Flow

1. **Authentication Flow**
   - User submits credentials → Server validates → Session created → Redirected to home
   - Protected routes check authentication status before rendering

2. **Form Discovery Flow**
   - User visits home → Client requests forms → Server returns forms with completion status → Client renders cards

3. **Form Creation Flow**
   - User submits form details → Validation occurs → Server stores form → Redirects to home with success message

4. **Form Completion Flow**
   - User clicks on form → Opens in new tab → Completes form → Returns to mark as complete → Provides rating and feedback

5. **Analytics Flow**
   - Dashboard loads → Fetches user stats, activity data, and completions → Renders charts and statistics

## External Dependencies

### Frontend Dependencies
- **React**: Core UI library
- **TanStack Query**: Data fetching and caching
- **React Hook Form**: Form handling and validation
- **Wouter**: Routing
- **Radix UI**: Accessible UI primitives
- **Tailwind CSS**: Utility-first styling
- **Recharts**: Data visualization
- **date-fns**: Date formatting and manipulation
- **Zod**: Schema validation

### Backend Dependencies
- **Express**: Web server framework
- **Passport**: Authentication middleware
- **Drizzle ORM**: Database access layer
- **express-session**: Session management
- **connect-pg-simple**: Session storage
- **crypto**: Password hashing

## Deployment Strategy

The application is configured for deployment on Replit with the following setup:
- **Development**: `npm run dev` starts both the frontend dev server and backend
- **Production Build**: `npm run build` bundles the React app and the server
- **Production Start**: `npm run start` runs the optimized production build
- **Database**: Uses PostgreSQL module in Replit
- **Environment Variables**:
  - `DATABASE_URL`: PostgreSQL connection string
  - `SESSION_SECRET`: Secret for signing the session ID cookie
  - `NODE_ENV`: Environment mode (development/production)

The deployment structure serves the React frontend as static files from the Express server, with API endpoints handling data operations. The application can automatically scale based on Replit's autoscale settings.

## Development Workflow

1. Run `npm run dev` to start the development server
2. Make changes to the frontend in the `client/src` directory
3. Implement backend functionality in the `server` directory
4. Shared types and schemas are in the `shared` directory
5. Run `npm run db:push` to update the database schema based on the Drizzle schema
6. Access the application at the provided Replit URL (port 5000 in development)