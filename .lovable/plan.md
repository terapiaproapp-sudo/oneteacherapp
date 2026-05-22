Implement visual and operational improvements to the Agenda page and Sidebar.

### 1. Status Color Updates (Agenda.tsx)
- Redefine `statusStyle`, `statusLabel`, and `dotColor` to match the requested color palette:
    - **Agendada**: Red (replacing blue)
    - **Realizada**: Green
    - **No-show**: Dark red/Bordeaux
    - **Remarcada**: Orange/Yellow
    - **Cancelada**: Gray
    - **Aula avulsa**: Purple (visual distinction)

### 2. View Mode and Filtering Logic
- Add `viewType` state: "Dia" | "Semana" | "Mês".
- Implement UI buttons/tabs to switch between these modes at the top of the Agenda.
- Update the `stats` calculation to dynamically switch context:
    - **Day**: Stats for the selected day.
    - **Week**: Stats for the week containing the selected/current day.
    - **Month**: Stats for the entire month currently viewed.
- Ensure the right-side (or bottom) lesson list reflects the active filter and groups lessons by day for week/month views.

### 3. Detailed Lesson List
- Enhance the lesson card UI to show:
    - Start and End time (auto-calculating end time if missing: `start + duration`).
    - Duration, Student Name, Subject, Modality, Type (Package/Avulsa), and Status.
- Improve spacing and typography for a "premium" look.

### 4. Navigation and Loading
- Verify that changing months correctly triggers data fetching and updates all UI elements (calendar dots, stats, and list).
- Ensure month display follows correct Portuguese capitalization ("Maio de 2026").

### 5. Branding (AppSidebar.tsx)
- Reposition and resize the logo for better visibility.
- Refine the greeting area to look more professional.

### Technical Details
- Use `date-fns` for robust interval calculations (`isWithinInterval`, `startOfWeek`, etc.).
- Maintain existing Supabase queries and state management to prevent breaking data integrity.
- Use Tailwind classes for the new status colors.
- Responsive layout adjustments: maintain the side-by-side view on desktop and stacked on mobile.
