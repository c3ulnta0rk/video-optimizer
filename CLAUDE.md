# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Video Optimizer is a cross-platform desktop application for video conversion and optimization, built with:
- **Frontend**: Angular 20 with Angular Material and TailwindCSS
- **Backend**: Rust with Tauri 2
- **Video Processing**: FFmpeg/ffprobe for conversion and metadata extraction

## Common Development Commands

### Development
```bash
# Install dependencies
bun install  # or npm install

# Start development server with hot reload
npm run tauri dev

# Build Angular app only
npm run build

# Build for production
npm run build:prod

# Build AppImage for Linux
npm run build:appimage
```

### Angular Dev Server
- The Angular development server runs on port 1420 (configured in angular.json)
- Tauri automatically opens the app window when running `npm run tauri dev`

## Architecture Overview

### Frontend Architecture (Angular/TypeScript)

The application follows Angular's component-based architecture with centralized services:

**Core Services** (`src/services/`):
- `conversion.service.ts` - Manages video conversion queue, progress tracking, and FFmpeg process coordination
- `files-manager.service.ts` - Handles file selection, video metadata, and file operations
- `video-config.service.ts` - Manages video configuration states and per-file settings
- `settings.service.ts` - Persists user preferences using Tauri's store plugin
- `ffmpeg-formats.service.ts` - Validates and manages FFmpeg format capabilities

**Component Structure** (`src/components/`):
- Main components handle UI sections (conversion, file selection, video details)
- Dialog components manage popups (settings, format selection, movie search)
- Shared components provide reusable UI elements

**State Management**:
- Uses Angular signals for reactive state management
- Services expose readonly signals consumed by components via computed signals
- Settings persisted to local storage via Tauri store plugin

### Backend Architecture (Rust/Tauri)

**Command Structure** (`src-tauri/src/`):
- `video_commands.rs` - FFmpeg/ffprobe integration, video metadata extraction, conversion process management
- `window_commands.rs` - Window management functions (minimize, maximize, dragging)
- Commands exposed to frontend via `invoke_handler` in `lib.rs`

**FFmpeg Integration**:
- Uses system-installed FFmpeg/ffprobe (not bundled)
- Child process management with real-time progress tracking
- Global mutex for single FFmpeg process enforcement
- Progress events emitted via Tauri's event system

**Plugin Architecture**:
- Tauri plugins handle native functionality (file dialog, notifications, shell commands)
- Plugins initialized in `lib.rs` and accessed via `@tauri-apps/plugin-*` packages

### Inter-Process Communication

**Frontend → Backend**: 
- Tauri commands invoked via `invoke()` from `@tauri-apps/api/core`
- Type-safe command interfaces with TypeScript/Rust structs

**Backend → Frontend**:
- Events emitted via `Emitter` trait for real-time updates
- Frontend subscribes using `listen()` from `@tauri-apps/api/event`
- Primary event: `conversion_progress` for FFmpeg progress updates

## Key Technical Considerations

### FFmpeg Process Management
- Single global FFmpeg process enforced via Rust mutex
- Cleanup function (`cleanup_ffmpeg_processes`) ensures no orphaned processes
- Progress parsing from FFmpeg stderr output with regex patterns
- Graceful cancellation support with process termination

### Type Safety
- TypeScript strict mode enabled with all strict checks
- Rust structs serialized/deserialized via serde
- Shared type definitions between Rust and TypeScript for video metadata

### Material Design Integration
- Angular Material components with custom theming
- Dark/light mode support with system preference detection
- TailwindCSS v4 for utility styling alongside Material components

### File Operations
- Native file picker via Tauri dialog plugin
- Support for single and multiple file selection
- Automatic video metadata extraction on file selection
- File size, duration, codec, and track information parsing

## Required System Dependencies

- **FFmpeg**: Must be installed system-wide for video conversion functionality
- **Node.js**: For Angular development and build processes
- **Rust**: For Tauri backend compilation
- **Bun/npm**: Package manager for JavaScript dependencies