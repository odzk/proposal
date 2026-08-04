'use client'

import { Editor } from '@tinymce/tinymce-react'

interface RichTextEditorProps {
  value:        string
  onChange:     (html: string) => void
  placeholder?: string
  height?:      number
}

/**
 * Thin wrapper around TinyMCE's React <Editor>, used by the proposal
 * wizard's Signature step (Step 8) to author the optional client-facing
 * custom message that renders above the Quote Approval signature block
 * (see lib/documentModel.ts's `signatureMessage` / ProposalDocument.tsx).
 *
 * Uses TinyMCE Cloud. Set NEXT_PUBLIC_TINYMCE_API_KEY in .env.local (a free
 * tier is available at https://www.tiny.cloud) for a production deployment
 * to remove the "This domain is not registered" notice — the editor is
 * fully functional either way, the notice is cosmetic only.
 */
export function RichTextEditor({ value, onChange, placeholder, height = 220 }: RichTextEditorProps) {
  return (
    <Editor
      apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || undefined}
      value={value}
      onEditorChange={onChange}
      init={{
        height,
        menubar: false,
        statusbar: false,
        plugins: 'lists link autolink',
        toolbar: 'bold italic underline | bullist numlist | link | removeformat',
        placeholder,
        branding: false,
        content_style: `
          body {
            font-family: 'Raleway', Arial, sans-serif;
            font-size: 14px;
            color: #1f2b2c;
          }
        `,
      }}
    />
  )
}
