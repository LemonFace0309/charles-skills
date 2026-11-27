export const metadata = { title: "PawPal", description: "Book a pet sitter in minutes" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "Inter, sans-serif" }}>
        {children}
        <footer>© PawPal · <a href="/terms">Terms</a></footer>
      </body>
    </html>
  );
}
