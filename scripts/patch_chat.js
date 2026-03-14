const fs = require('fs');

const IMAGE_HANDLER = `
  async function handleSendImage(file) {
    if (!student?.studioId || !teacherId) return;
    setSendingImage(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = 'chat/' + student.studioId + '/' + student.id + '/' + Date.now() + '.' + ext;
      const { error: upErr } = await supabase.storage.from('chat-images').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
      const svc = ChatService.create(supabase);
      await svc.sendPrivateMessage(student.studioId, student.id, student.displayName, teacherId, 'IMAGE:' + urlData.publicUrl);
      const fresh = await svc.getPrivateThread(student.studioId, student.id, teacherId);
      setPrivateMessages(fresh);
      setTab('private');
    } catch (err) { console.error('Image upload failed:', err); }
    finally { setSendingImage(false); }
  }

`;

const TEACHER_IMAGE_HANDLER = `
  async function handleSendImage(file) {
    if (!teacher?.studioId) return;
    setSendingImage(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = 'chat/' + teacher.studioId + '/' + teacher.id + '/' + Date.now() + '.' + ext;
      const { error: upErr } = await supabase.storage.from('chat-images').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
      const service = ChatService.create(supabase);
      if (selectedStudent === null) {
        await service.postAnnouncement(teacher.studioId, teacher.id, teacher.displayName, 'IMAGE:' + urlData.publicUrl);
        setMessages(await service.getAnnouncements(teacher.studioId));
      } else {
        await service.sendPrivateMessage(teacher.studioId, teacher.id, teacher.displayName, selectedStudent.id, 'IMAGE:' + urlData.publicUrl);
        setMessages(await service.getPrivateThread(teacher.studioId, teacher.id, selectedStudent.id));
      }
    } catch (err) { console.error('Image upload failed:', err); }
    finally { setSendingImage(false); }
  }

`;

// IMAGE rendering snippet (after videoSrc check, before plain text)
const IMAGE_RENDER = `                ) : msg.content.startsWith('IMAGE:') ? (
                  <div style={{ maxWidth: "78%", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", overflow: "hidden" }}>
                    <img src={msg.content.slice(6)} alt="shared image" style={{ display: "block", width: "100%", maxWidth: 280, borderRadius: "inherit" }} />
                  </div>`;

// ── Student chat ──
let s = fs.readFileSync('app/student/chat/page.tsx', 'utf8');

// Add refs + state
s = s.replace(
  'const bottomRef = useRef<HTMLDivElement>(null);\n  const inputRef = useRef<HTMLTextAreaElement>(null);',
  'const bottomRef = useRef<HTMLDivElement>(null);\n  const inputRef = useRef<HTMLTextAreaElement>(null);\n  const imageInputRef = useRef<HTMLInputElement>(null);\n  const [sendingImage, setSendingImage] = useState(false);'
);

// Add handler before handleKeyDown
s = s.replace('  function handleKeyDown(e: React.KeyboardEvent) {', IMAGE_HANDLER + '  function handleKeyDown(e: React.KeyboardEvent) {');

// Add IMAGE rendering (after videoSrc case, before audioSrc case)
s = s.replace(
  ') : videoSrc ? (\n                  <div style={{ maxWidth: "78%", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", overflow: "hidden", border: isMe ? "none" : "1px solid var(--border-strong)" }}>\n                    <video controls src={videoSrc} style={{ display: "block", width: "100%", maxWidth: 280 }} />\n                  </div>',
  ') : videoSrc ? (\n                  <div style={{ maxWidth: "78%", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", overflow: "hidden", border: isMe ? "none" : "1px solid var(--border-strong)" }}>\n                    <video controls src={videoSrc} style={{ display: "block", width: "100%", maxWidth: 280 }} />\n                  </div>\n' + IMAGE_RENDER
);

// Add image button + hidden input in the toolbar (after camera button, before send)
s = s.replace(
  '          <button onClick={handleSend} disabled={!input.trim() || sending || !teacherId || isRecording}',
  `          {/* Hidden image input */}
          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { void handleSendImage(f); e.target.value = ''; } }} />
          {/* Image button */}
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={sending || isRecording || uploadingAudio || sendingImage || !teacherId}
            title="Send image"
            style={{
              padding: "0.5rem 0.625rem", borderRadius: 3, border: "1px solid var(--border)",
              background: "var(--white)", color: sendingImage ? "var(--muted)" : "var(--muted)",
              cursor: sending || isRecording || uploadingAudio || sendingImage || !teacherId ? "default" : "pointer",
              fontSize: "1rem", flexShrink: 0, marginBottom: "0.0625rem",
            }}
          >
            {sendingImage ? "⏳" : "🖼"}
          </button>
          <button onClick={handleSend} disabled={!input.trim() || sending || !teacherId || isRecording}`
);

fs.writeFileSync('app/student/chat/page.tsx', s);
console.log('student chat done');

// ── Teacher chat ──
let t = fs.readFileSync('app/teacher/chat/page.tsx', 'utf8');

// Add state
t = t.replace(
  '  const { isRecording, recordingSeconds, uploadingAudio, audioError, startRecording, stopRecording, clearError } = useRecording();\n  const [showVideoRecorder, setShowVideoRecorder] = useState(false);\n  const bottomRef',
  '  const { isRecording, recordingSeconds, uploadingAudio, audioError, startRecording, stopRecording, clearError } = useRecording();\n  const [showVideoRecorder, setShowVideoRecorder] = useState(false);\n  const imageInputRef = React.useRef<HTMLInputElement>(null);\n  const [sendingImage, setSendingImage] = useState(false);\n  const bottomRef'
);

// Add handler before handleKeyDown
t = t.replace('  function handleKeyDown(e: React.KeyboardEvent) {', TEACHER_IMAGE_HANDLER + '  function handleKeyDown(e: React.KeyboardEvent) {');

// Add IMAGE rendering (teacher side — after videoSrc, add IMAGE case)
const TEACHER_IMAGE_RENDER = `                  ) : msg.content.startsWith('IMAGE:') ? (
                    <div style={{ maxWidth: "66%", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", overflow: "hidden" }}>
                      <img src={msg.content.slice(6)} alt="shared image" style={{ display: "block", width: "100%", maxWidth: 280, borderRadius: "inherit" }} />
                    </div>`;

t = t.replace(
  '                  ) : videoSrc ? (\n                    <div style={{ maxWidth: "66%", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", overflow: "hidden", border: isMe ? "none" : "1px solid var(--border-strong)" }}>\n                      <video controls src={videoSrc} style={{ display: "block", width: "100%", maxWidth: 280 }} />\n                    </div>',
  '                  ) : videoSrc ? (\n                    <div style={{ maxWidth: "66%", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", overflow: "hidden", border: isMe ? "none" : "1px solid var(--border-strong)" }}>\n                      <video controls src={videoSrc} style={{ display: "block", width: "100%", maxWidth: 280 }} />\n                    </div>\n' + TEACHER_IMAGE_RENDER
);

// Add image button in teacher toolbar
t = t.replace(
  '            <button\n              onClick={handleSend}\n              disabled={!input.trim() || sending || isRecording}',
  `            {/* Hidden image input */}
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { void handleSendImage(f); e.target.value = ''; } }} />
            {/* Image button */}
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={sending || isRecording || uploadingAudio || sendingImage}
              title="Send image"
              style={{
                padding: "0.5625rem 0.75rem", borderRadius: 3, border: "1px solid var(--border)",
                background: "var(--white)", color: "var(--muted)",
                cursor: sending || isRecording || uploadingAudio || sendingImage ? "default" : "pointer",
                fontSize: "1rem", flexShrink: 0, marginBottom: "0.125rem",
              }}
            >
              {sendingImage ? "⏳" : "🖼"}
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending || isRecording}`
);

fs.writeFileSync('app/teacher/chat/page.tsx', t);
console.log('teacher chat done');
