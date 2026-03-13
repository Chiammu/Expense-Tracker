# Theme UI Notes

## What Changed
- Reworked theme tokens for light/dark surfaces, text, borders, and controls in `index.html`.
- Strengthened control focus/hover styles for a more consistent premium feel.
- Added custom dropdown and date picker components and wired them into key flows.
- Theme selector in Settings now supports Light/Dark/System.
- Default theme is `dark`.

## Files Touched
- `index.html`
- `index.css`
- `components/CustomSelect.tsx`
- `components/CustomDatePicker.tsx`
- `components/BankImport.tsx`
- `components/CashWallet.tsx`
- `components/Challenges.tsx`
- `components/Settings.tsx`
- `types.ts`

## Notes
- Custom controls use the control surface tokens (`--control-*`) and popover tokens (`--popover-*`).
- Theme preference persists via `settings.theme` and is applied by the existing theme logic in `App.tsx`.
