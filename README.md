# PM-agent
 
An AI assistant for project managers: it interviews you about a project, then turns the conversation into finished deliverables — a PowerPoint deck or a Word document — instead of leaving you with chat output to copy-paste.
 
Built as a personal project alongside my master's thesis on applying AI to IT project planning. The thesis studied what makes AI tools actually get used in project work; this application was an attempt to build one end to end and see where the hard parts really are.
 
## What it does
 
- **Structured interview.** Instead of a blank chat box, the agent asks about the project step by step and keeps track of what it still needs.
- **Document generation.** Produces `.pptx` and `.docx` files from the collected material, generated server-side with python-pptx and python-docx.
- **File input.** Reads existing project material from PDF and Excel files and uses it as context.
- **Number checking.** A verification endpoint checks figures in generated content against the source material, to catch numbers the model invented.
- **Projects and profiles.** Users can save projects, generated presentations, and reusable agent profiles that adjust how the assistant behaves.
- **Accounts.** Registration and login with JWT sessions, password hashing, rate limiting on auth and chat endpoints, and a small admin view for user management.
## Stack
 
**Frontend** — React, Vite. Deployed on Vercel.
**Backend** — Node.js, Express 5, Anthropic SDK (Claude), SQLite via better-sqlite3, JWT auth, express-rate-limit, pdf-parse.
**Document generation** — Python (python-pptx, python-docx, openpyxl) called from the Node backend.
 
## Status
 
A working prototype, not a product. It was built to test one idea: that the useful output of an AI assistant in project work is a finished document, not a conversation. The interesting problems turned out to be the unglamorous ones — keeping generated numbers honest, and giving the model enough structure that its output is worth editing rather than rewriting.
 
## Notes
 
Interface text is in Finnish and English. The document templates are generic; the tool was designed so that an organisation's own template can be dropped in.
 