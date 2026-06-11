// UI strings localized for every language in CONTENT_LANGUAGE_OPTIONS.
//
// Why a hand-written record instead of a heavyweight i18n framework:
// - The set of strings is small and bounded (chat status, error toasts,
//   placeholders) and we already ship a language-resolver in
//   languageService.ts. A framework would dwarf the actual content.
// - One file = one place to add a string in 11 languages = one place a
//   PR reviewer checks for completeness.
//
// Adding a new key:
//   1. Add it to the UiKey union.
//   2. Provide every language in MESSAGES (en is required; missing
//      languages fall back to en at runtime).
//   3. Use it from a component via `t('the-key', userProfile?.language)`.

import { resolveContentLanguage } from './languageService';

export type UiKey =
    // Chat
    | 'chat.welcome'
    | 'chat.errorReply'
    | 'chat.quizSuggestionFallback'
    | 'chat.scopeChange.document'
    | 'chat.scopeChange.general'
    | 'chat.monkeyMode.on'
    | 'chat.monkeyMode.off'
    | 'chat.retry'
    // Study tips fallbacks
    | 'studyTips.error'
    | 'frq.gradeError'
    // Podcast UI
    | 'podcast.documentMissing'
    | 'podcast.newScript'
    | 'podcast.generateScript'
    | 'podcast.generating'
    | 'podcast.cancel'
    // Quiz / generators
    | 'quiz.docMissing'
    // File handler
    | 'file.unsupportedType'
    // Common actions
    | 'common.cancel'
    | 'common.close'
    | 'common.back'
    | 'common.confirm'
    | 'common.delete'
    // Empty workspace (signed in, zero documents)
    | 'workspace.empty.title'
    | 'workspace.empty.subtitle'
    | 'workspace.empty.uploadHint'
    // Empty workspace (has docs, none selected)
    | 'workspace.selectDoc.title'
    | 'workspace.selectDoc.subtitle'
    // Sign-out confirmation
    | 'signout.title'
    | 'signout.body'
    | 'signout.confirm'
    // Quiz exit guard
    | 'quiz.exitWarn'
    // Quiz celebration
    | 'quiz.celebrate.perfect'
    | 'quiz.celebrate.great'
    | 'quiz.celebrate.good'
    // Account deletion
    | 'account.delete.label'
    | 'account.delete.title'
    | 'account.delete.body'
    | 'account.delete.requestSent'
    | 'account.delete.done'
    | 'account.delete.error'
    // Account security (email / password)
    | 'account.section'
    | 'account.email.label'
    | 'account.email.change'
    | 'account.email.new'
    | 'account.email.invalid'
    | 'account.email.sent'
    | 'account.email.error'
    | 'account.password.label'
    | 'account.password.change'
    | 'account.password.current'
    | 'account.password.new'
    | 'account.password.confirm'
    | 'account.password.mismatch'
    | 'account.password.tooShort'
    | 'account.password.wrong'
    | 'account.password.updated'
    | 'account.password.error'
    | 'account.google.note'
    | 'common.save'
    // 404
    | 'notFound.title'
    | 'notFound.subtitle'
    | 'notFound.cta'
    // Legal
    | 'legal.privacy'
    | 'legal.terms';

type Lang = string;

// Each key carries every supported language. English is the runtime
// fallback when a translation is missing or the user's language is one
// we haven't covered.
const MESSAGES: Record<UiKey, Record<Lang, string>> = {
    'chat.welcome': {
        en: "Hello! I've finished reading your document. What would you like to know? You can ask me a question or try one of the suggestions below. Let's get learning! 🚀",
        ko: '안녕하세요! 문서를 다 읽었어요. 무엇이 궁금하신가요? 자유롭게 질문하시거나 아래 추천 질문 중 하나를 골라보세요. 함께 공부해봐요! 🚀',
        ja: 'こんにちは！ドキュメントを読み終えました。何が気になりますか？質問していただいてもいいですし、下のおすすめから選んでもOKです。一緒に学んでいきましょう！🚀',
        zh: '你好！我已经读完你的文档了。想了解什么呢？可以直接提问，也可以试试下面的建议。一起来学习吧！🚀',
        es: '¡Hola! He terminado de leer tu documento. ¿Qué te gustaría saber? Puedes hacerme una pregunta o probar una de las sugerencias de abajo. ¡A aprender! 🚀',
        fr: 'Bonjour ! J\'ai terminé de lire votre document. Que souhaitez-vous savoir ? Posez-moi une question ou essayez l\'une des suggestions ci-dessous. C\'est parti pour apprendre ! 🚀',
        de: 'Hallo! Ich habe dein Dokument gelesen. Was möchtest du wissen? Stell mir eine Frage oder probiere einen der Vorschläge unten. Auf zum Lernen! 🚀',
        pt: 'Olá! Terminei de ler o seu documento. O que gostaria de saber? Faça uma pergunta ou experimente uma das sugestões abaixo. Vamos aprender! 🚀',
        ru: 'Привет! Я прочитал ваш документ. Что вас интересует? Можете задать вопрос или выбрать один из вариантов ниже. Учимся вместе! 🚀',
        vi: 'Xin chào! Mình đã đọc xong tài liệu của bạn. Bạn muốn biết điều gì? Hãy đặt câu hỏi hoặc chọn một trong các gợi ý bên dưới. Cùng học nào! 🚀',
        id: 'Halo! Saya sudah selesai membaca dokumen Anda. Apa yang ingin Anda ketahui? Silakan bertanya atau coba salah satu saran di bawah. Mari belajar! 🚀',
    },
    'chat.errorReply': {
        en: 'Sorry, I encountered an error. Please try again. 🙏',
        ko: '죄송해요, 오류가 발생했어요. 잠시 후 다시 시도해 주세요. 🙏',
        ja: 'すみません、エラーが発生しました。もう一度お試しください。🙏',
        zh: '抱歉，出错了。请稍后再试。🙏',
        es: 'Lo siento, ocurrió un error. Por favor, inténtalo de nuevo. 🙏',
        fr: 'Désolé, une erreur est survenue. Veuillez réessayer. 🙏',
        de: 'Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuche es erneut. 🙏',
        pt: 'Desculpe, ocorreu um erro. Por favor, tente novamente. 🙏',
        ru: 'Извините, произошла ошибка. Пожалуйста, повторите попытку. 🙏',
        vi: 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại. 🙏',
        id: 'Maaf, terjadi kesalahan. Silakan coba lagi. 🙏',
    },
    'chat.quizSuggestionFallback': {
        en: "Great idea! Let's head over to the Quiz tab to create a test for you. ✨",
        ko: '좋은 생각이에요! 퀴즈 탭으로 가서 문제를 만들어볼게요. ✨',
        ja: 'いいですね！クイズタブに移動して問題を作りましょう。✨',
        zh: '好主意！我们去测验标签页给你出几道题吧。✨',
        es: '¡Buena idea! Vamos a la pestaña de Quiz para crear un test. ✨',
        fr: 'Bonne idée ! Allons dans l\'onglet Quiz pour créer un test. ✨',
        de: 'Tolle Idee! Lass uns zum Quiz-Tab gehen und einen Test erstellen. ✨',
        pt: 'Ótima ideia! Vamos à aba de Quiz para criar um teste. ✨',
        ru: 'Отличная идея! Перейдём во вкладку викторины и создадим тест. ✨',
        vi: 'Ý hay đấy! Hãy chuyển sang tab Quiz để tạo bài kiểm tra nhé. ✨',
        id: 'Ide bagus! Mari ke tab Quiz untuk membuat soal. ✨',
    },
    'chat.scopeChange.document': {
        en: 'My focus is narrowed.\nI will now answer questions based only on the document.',
        ko: '시야를 좁혔어요.\n이제 문서 내용만을 바탕으로 답변할게요.',
        ja: '範囲を絞りました。\nこれからはドキュメントの内容だけをもとに答えます。',
        zh: '我把范围缩小了。\n现在只会根据文档内容来回答。',
        es: 'He limitado mi enfoque.\nAhora responderé solo basándome en el documento.',
        fr: 'J\'ai recentré mes réponses.\nJe répondrai désormais uniquement à partir du document.',
        de: 'Ich habe meinen Fokus eingegrenzt.\nIch antworte ab jetzt nur noch auf Basis des Dokuments.',
        pt: 'Meu foco está mais restrito.\nVou responder somente com base no documento.',
        ru: 'Я сузил область ответа.\nТеперь буду отвечать только на основе документа.',
        vi: 'Mình đã thu hẹp phạm vi.\nTừ giờ chỉ trả lời dựa trên nội dung tài liệu.',
        id: 'Cakupan saya sudah dipersempit.\nMulai sekarang saya hanya menjawab berdasarkan dokumen.',
    },
    'chat.scopeChange.general': {
        en: 'My scope has expanded!\nI can now use my general knowledge to answer your questions.',
        ko: '시야를 넓혔어요!\n이제 일반 지식까지 활용해서 답변할게요.',
        ja: '範囲を広げました！\n一般的な知識も使って答えられます。',
        zh: '我把范围扩大了！\n现在可以结合通用知识来回答你的问题。',
        es: '¡He ampliado mi alcance!\nAhora puedo usar mi conocimiento general para responder.',
        fr: 'J\'ai élargi mes réponses !\nJe peux maintenant utiliser mes connaissances générales.',
        de: 'Ich habe meinen Horizont erweitert!\nIch nutze jetzt auch mein allgemeines Wissen.',
        pt: 'Meu alcance foi ampliado!\nAgora posso usar conhecimento geral para responder.',
        ru: 'Я расширил область ответа!\nТеперь могу использовать общие знания.',
        vi: 'Mình đã mở rộng phạm vi!\nGiờ có thể dùng kiến thức tổng quát để trả lời.',
        id: 'Cakupan saya diperluas!\nSekarang saya bisa pakai pengetahuan umum untuk menjawab.',
    },
    'chat.monkeyMode.on': {
        en: "Ooki-ooki! The clever, mischievous monkey is here! 🍌 I'll be answering from now on! Eek!",
        ko: '우끼끼! 영리하고 짓궂은 원숭이가 등장했어요! 🍌 이제부터 제가 답할게요! 이히!',
        ja: 'ウキウキ！賢くてイタズラ好きな猿が登場！🍌 今からは僕が答えるよ！キキッ！',
        zh: '吱吱！聪明又调皮的猴子来啦！🍌 接下来由我来回答！嘿嘿！',
        es: '¡Uki-uki! ¡Llegó el mono listo y travieso! 🍌 ¡A partir de ahora respondo yo! ¡Iik!',
        fr: 'Ouki-ouki ! Le singe malin et farceur est là ! 🍌 C\'est moi qui réponds maintenant ! Iik !',
        de: 'Uki-uki! Der kluge, schelmische Affe ist da! 🍌 Ab jetzt antworte ich! Iik!',
        pt: 'Uki-uki! O macaco esperto e travesso chegou! 🍌 A partir de agora eu respondo! Iik!',
        ru: 'Уки-уки! Хитрая озорная обезьянка тут! 🍌 Теперь отвечать буду я!',
        vi: 'Khẹc khẹc! Chú khỉ tinh nghịch đã đến! 🍌 Từ giờ tôi sẽ trả lời nhé!',
        id: 'Uki-uki! Monyet pintar dan jahil tiba! 🍌 Mulai sekarang aku yang menjawab!',
    },
    'chat.monkeyMode.off': {
        en: "Phew, that's enough mischief for now. Back to serious study mode.",
        ko: '휴, 이쯤이면 충분해요. 다시 진지한 학습 모드로 돌아갈게요.',
        ja: 'ふぅ、イタズラはここまで。真面目な学習モードに戻ります。',
        zh: '呼，恶作剧到此为止。回到认真学习模式。',
        es: 'Uf, suficiente travesura por ahora. De vuelta al modo de estudio serio.',
        fr: 'Ouf, ça suffit les bêtises. Retour au mode étude sérieux.',
        de: 'Puh, genug Unsinn für jetzt. Zurück in den seriösen Lernmodus.',
        pt: 'Ufa, travessuras o suficiente. De volta ao modo de estudo sério.',
        ru: 'Уф, шалостей достаточно. Возвращаюсь к серьёзному режиму учёбы.',
        vi: 'Phù, đùa nghịch vậy đủ rồi. Quay lại chế độ học nghiêm túc nhé.',
        id: 'Fiuh, cukup keisengan untuk sekarang. Kembali ke mode belajar serius.',
    },
    'chat.retry': {
        en: 'Retry',
        ko: '다시 시도',
        ja: '再試行',
        zh: '重试',
        es: 'Reintentar',
        fr: 'Réessayer',
        de: 'Erneut versuchen',
        pt: 'Tentar de novo',
        ru: 'Повторить',
        vi: 'Thử lại',
        id: 'Coba lagi',
    },
    'studyTips.error': {
        en: "Sorry, I couldn't generate study tips at this time.",
        ko: '학습 팁을 생성하지 못했어요. 잠시 후 다시 시도해 주세요.',
        ja: '学習のヒントを生成できませんでした。後でもう一度お試しください。',
        zh: '抱歉，现在无法生成学习建议。',
        es: 'Lo siento, no pude generar consejos de estudio en este momento.',
        fr: 'Désolé, je n\'ai pas pu générer de conseils d\'étude pour le moment.',
        de: 'Entschuldigung, ich konnte gerade keine Lerntipps erstellen.',
        pt: 'Desculpe, não consegui gerar dicas de estudo agora.',
        ru: 'Извините, сейчас не получилось подготовить советы по учёбе.',
        vi: 'Xin lỗi, hiện chưa thể tạo gợi ý học tập.',
        id: 'Maaf, saya belum bisa membuat tips belajar saat ini.',
    },
    'frq.gradeError': {
        en: 'Sorry, an error occurred while grading this answer.',
        ko: '답안 채점 중 오류가 발생했어요.',
        ja: '採点中にエラーが発生しました。',
        zh: '抱歉，评分时出现了错误。',
        es: 'Lo siento, ocurrió un error al calificar esta respuesta.',
        fr: 'Désolé, une erreur est survenue lors de la correction.',
        de: 'Beim Bewerten der Antwort ist ein Fehler aufgetreten.',
        pt: 'Desculpe, ocorreu um erro ao corrigir esta resposta.',
        ru: 'Извините, при оценке ответа произошла ошибка.',
        vi: 'Xin lỗi, đã xảy ra lỗi khi chấm bài.',
        id: 'Maaf, terjadi kesalahan saat menilai jawaban ini.',
    },
    'podcast.documentMissing': {
        en: 'Document content not available',
        ko: '문서 내용을 불러올 수 없어요',
        ja: 'ドキュメントの内容がありません',
        zh: '无法读取文档内容',
        es: 'Contenido del documento no disponible',
        fr: 'Contenu du document indisponible',
        de: 'Dokumentinhalt nicht verfügbar',
        pt: 'Conteúdo do documento indisponível',
        ru: 'Содержимое документа недоступно',
        vi: 'Không có nội dung tài liệu',
        id: 'Konten dokumen tidak tersedia',
    },
    'podcast.newScript': {
        en: 'New Script',
        ko: '새 스크립트',
        ja: '新しい台本',
        zh: '新脚本',
        es: 'Nuevo guion',
        fr: 'Nouveau script',
        de: 'Neues Skript',
        pt: 'Novo roteiro',
        ru: 'Новый сценарий',
        vi: 'Kịch bản mới',
        id: 'Skrip baru',
    },
    'podcast.generateScript': {
        en: 'Generate Script',
        ko: '스크립트 생성',
        ja: '台本を生成',
        zh: '生成脚本',
        es: 'Generar guion',
        fr: 'Générer le script',
        de: 'Skript erstellen',
        pt: 'Gerar roteiro',
        ru: 'Создать сценарий',
        vi: 'Tạo kịch bản',
        id: 'Buat skrip',
    },
    'podcast.generating': {
        en: 'Generating…',
        ko: '생성 중…',
        ja: '生成中…',
        zh: '生成中…',
        es: 'Generando…',
        fr: 'Génération…',
        de: 'Wird erstellt…',
        pt: 'Gerando…',
        ru: 'Создаётся…',
        vi: 'Đang tạo…',
        id: 'Membuat…',
    },
    'podcast.cancel': {
        en: 'Cancel',
        ko: '취소',
        ja: 'キャンセル',
        zh: '取消',
        es: 'Cancelar',
        fr: 'Annuler',
        de: 'Abbrechen',
        pt: 'Cancelar',
        ru: 'Отмена',
        vi: 'Huỷ',
        id: 'Batal',
    },
    'quiz.docMissing': {
        en: 'Document content is not available to generate a quiz.',
        ko: '퀴즈를 만들려면 문서 내용이 필요해요.',
        ja: 'クイズを作成するためのドキュメント内容がありません。',
        zh: '没有可用于生成测验的文档内容。',
        es: 'No hay contenido del documento para generar un cuestionario.',
        fr: 'Aucun contenu de document disponible pour générer un quiz.',
        de: 'Kein Dokumentinhalt zum Erstellen eines Quiz verfügbar.',
        pt: 'Sem conteúdo do documento para gerar um quiz.',
        ru: 'Нет содержимого документа для создания викторины.',
        vi: 'Không có nội dung tài liệu để tạo bài kiểm tra.',
        id: 'Tidak ada konten dokumen untuk membuat kuis.',
    },
    'file.unsupportedType': {
        en: 'Unsupported file type. Please upload a PDF, image, plain text, or Markdown file.',
        ko: '지원하지 않는 파일 형식이에요. PDF, 이미지, 텍스트, 또는 Markdown 파일을 올려주세요.',
        ja: 'サポートされていないファイル形式です。PDF・画像・テキスト・Markdown のいずれかをアップロードしてください。',
        zh: '不支持的文件类型。请上传 PDF、图片、纯文本或 Markdown 文件。',
        es: 'Tipo de archivo no compatible. Sube un PDF, imagen, texto plano o Markdown.',
        fr: 'Type de fichier non pris en charge. Téléversez un PDF, une image, du texte ou un Markdown.',
        de: 'Nicht unterstützter Dateityp. Bitte lade eine PDF, ein Bild, eine Textdatei oder Markdown hoch.',
        pt: 'Tipo de arquivo não suportado. Envie um PDF, imagem, texto puro ou Markdown.',
        ru: 'Неподдерживаемый тип файла. Загрузите PDF, изображение, текст или Markdown.',
        vi: 'Loại tệp không được hỗ trợ. Hãy tải lên PDF, hình ảnh, văn bản hoặc Markdown.',
        id: 'Tipe berkas tidak didukung. Unggah PDF, gambar, teks, atau Markdown.',
    },
    'common.cancel': {
        en: 'Cancel', ko: '취소', ja: 'キャンセル', zh: '取消',
        es: 'Cancelar', fr: 'Annuler', de: 'Abbrechen', pt: 'Cancelar',
        ru: 'Отмена', vi: 'Huỷ', id: 'Batal',
    },
    'common.close': {
        en: 'Close', ko: '닫기', ja: '閉じる', zh: '关闭',
        es: 'Cerrar', fr: 'Fermer', de: 'Schließen', pt: 'Fechar',
        ru: 'Закрыть', vi: 'Đóng', id: 'Tutup',
    },
    'common.back': {
        en: 'Back', ko: '뒤로', ja: '戻る', zh: '返回',
        es: 'Volver', fr: 'Retour', de: 'Zurück', pt: 'Voltar',
        ru: 'Назад', vi: 'Quay lại', id: 'Kembali',
    },
    'common.confirm': {
        en: 'Confirm', ko: '확인', ja: '確認', zh: '确认',
        es: 'Confirmar', fr: 'Confirmer', de: 'Bestätigen', pt: 'Confirmar',
        ru: 'Подтвердить', vi: 'Xác nhận', id: 'Konfirmasi',
    },
    'common.delete': {
        en: 'Delete', ko: '삭제', ja: '削除', zh: '删除',
        es: 'Eliminar', fr: 'Supprimer', de: 'Löschen', pt: 'Excluir',
        ru: 'Удалить', vi: 'Xoá', id: 'Hapus',
    },

    'workspace.empty.title': {
        en: 'Bring me something to read 🍌',
        ko: '읽을 거 하나 주세요 🍌',
        ja: '何か読ませてください 🍌',
        zh: '给我点东西读读吧 🍌',
        es: 'Tráeme algo para leer 🍌',
        fr: 'Apportez-moi quelque chose à lire 🍌',
        de: 'Gib mir etwas zu lesen 🍌',
        pt: 'Me traga algo para ler 🍌',
        ru: 'Принесите мне что-нибудь почитать 🍌',
        vi: 'Cho mình thứ gì đó để đọc nhé 🍌',
        id: 'Beri saya sesuatu untuk dibaca 🍌',
    },
    'workspace.empty.subtitle': {
        en: 'Upload a PDF, a photo of your notes, or any text. I\'ll read it carefully and we can study together.',
        ko: 'PDF, 노트 사진, 어떤 텍스트든 좋아요. 제가 꼼꼼히 읽고 같이 공부해드릴게요.',
        ja: 'PDF・ノートの写真・テキスト、なんでもどうぞ。じっくり読んで一緒に勉強しましょう。',
        zh: 'PDF、笔记照片或任何文本都可以。我会认真读，然后一起学习。',
        es: 'Sube un PDF, una foto de tus apuntes o cualquier texto. Lo leeré con cuidado y estudiaremos juntos.',
        fr: 'Téléverse un PDF, une photo de tes notes ou n\'importe quel texte. Je lirai attentivement et on étudiera ensemble.',
        de: 'Lad eine PDF, ein Foto deiner Notizen oder einen Text hoch. Ich lese sorgfältig und wir lernen zusammen.',
        pt: 'Envie um PDF, foto das suas anotações ou qualquer texto. Vou ler com atenção e estudaremos juntos.',
        ru: 'Загрузите PDF, фото заметок или любой текст. Я внимательно прочитаю, и будем учиться вместе.',
        vi: 'Tải lên PDF, ảnh ghi chú hay bất kỳ văn bản nào. Mình sẽ đọc kỹ và cùng học với bạn.',
        id: 'Unggah PDF, foto catatan, atau teks apa pun. Saya akan baca dengan saksama dan kita belajar bareng.',
    },
    'workspace.empty.uploadHint': {
        en: 'Drop a file here or use the upload button',
        ko: '파일을 끌어다 놓거나 업로드 버튼을 눌러주세요',
        ja: 'ファイルをドロップするか、アップロードボタンを押してください',
        zh: '把文件拖到这里或点击上传按钮',
        es: 'Arrastra un archivo aquí o usa el botón de subida',
        fr: 'Glisse un fichier ici ou clique sur le bouton',
        de: 'Datei hierher ziehen oder Upload-Button klicken',
        pt: 'Arraste um arquivo aqui ou use o botão de envio',
        ru: 'Перетащите файл сюда или нажмите кнопку загрузки',
        vi: 'Kéo tệp vào đây hoặc dùng nút tải lên',
        id: 'Letakkan berkas di sini atau pakai tombol unggah',
    },

    'workspace.selectDoc.title': {
        en: 'Pick a document to dive in 🐒',
        ko: '시작할 문서를 골라주세요 🐒',
        ja: '読み始める文書を選んでください 🐒',
        zh: '挑一个文档开始吧 🐒',
        es: 'Elige un documento para empezar 🐒',
        fr: 'Choisis un document pour commencer 🐒',
        de: 'Wähle ein Dokument zum Eintauchen 🐒',
        pt: 'Escolha um documento para começar 🐒',
        ru: 'Выберите документ, чтобы начать 🐒',
        vi: 'Chọn một tài liệu để bắt đầu 🐒',
        id: 'Pilih dokumen untuk memulai 🐒',
    },
    'workspace.selectDoc.subtitle': {
        en: 'Your library is on the left. Tap one and we\'ll keep going.',
        ko: '왼쪽 목록에서 하나 골라주세요. 이어서 갈게요.',
        ja: '左の一覧から選んでください。続きを始めましょう。',
        zh: '在左侧列表里挑一个，我们接着学。',
        es: 'Tu biblioteca está a la izquierda. Toca uno y seguimos.',
        fr: 'Ta bibliothèque est à gauche. Touche un fichier et on continue.',
        de: 'Deine Bibliothek ist links. Tipp eines an und wir machen weiter.',
        pt: 'Sua biblioteca está à esquerda. Toque em um e continuamos.',
        ru: 'Ваша библиотека слева. Нажмите на один — продолжим.',
        vi: 'Thư viện ở bên trái. Chạm vào một mục và mình tiếp tục.',
        id: 'Pustaka Anda ada di kiri. Pilih satu dan kita lanjut.',
    },

    'signout.title': {
        en: 'See you next session?',
        ko: '다음에 또 만나요?',
        ja: 'また次回お会いしましょう？',
        zh: '下次再见？',
        es: '¿Hasta la próxima?',
        fr: 'À la prochaine ?',
        de: 'Bis zum nächsten Mal?',
        pt: 'Até a próxima?',
        ru: 'До следующей встречи?',
        vi: 'Hẹn gặp lại lần sau?',
        id: 'Sampai jumpa lagi?',
    },
    'signout.body': {
        en: 'Your work is saved — sign back in anytime to pick up where you left off.',
        ko: '작업은 모두 저장됐어요 — 언제든 다시 로그인해서 이어가실 수 있어요.',
        ja: '作業はすべて保存されています — いつでも再ログインして続きから始められます。',
        zh: '你的内容都保存好了 — 随时登录就能接着学。',
        es: 'Tu trabajo está guardado — vuelve cuando quieras y sigue donde lo dejaste.',
        fr: 'Ton travail est sauvegardé — reconnecte-toi quand tu veux pour reprendre.',
        de: 'Deine Arbeit ist gespeichert — melde dich jederzeit wieder an und mach weiter.',
        pt: 'Seu trabalho está salvo — volte quando quiser e continue de onde parou.',
        ru: 'Работа сохранена — вернитесь в любой момент и продолжите с того же места.',
        vi: 'Bài làm đã được lưu — đăng nhập lại bất cứ lúc nào để tiếp tục.',
        id: 'Pekerjaan Anda tersimpan — masuk lagi kapan saja untuk lanjut.',
    },
    'signout.confirm': {
        en: 'Sign out', ko: '로그아웃', ja: 'ログアウト', zh: '登出',
        es: 'Cerrar sesión', fr: 'Se déconnecter', de: 'Abmelden', pt: 'Sair',
        ru: 'Выйти', vi: 'Đăng xuất', id: 'Keluar',
    },

    'quiz.exitWarn': {
        en: 'Quiz in progress — leave anyway?',
        ko: '퀴즈가 진행 중이에요 — 정말 나가시겠어요?',
        ja: 'クイズが進行中です — 本当に離れますか？',
        zh: '测验进行中 — 确定要离开吗？',
        es: 'Quiz en progreso — ¿salir igualmente?',
        fr: 'Quiz en cours — sortir quand même ?',
        de: 'Quiz läuft — trotzdem verlassen?',
        pt: 'Quiz em andamento — sair mesmo assim?',
        ru: 'Викторина не окончена — всё равно выйти?',
        vi: 'Đang làm bài — vẫn rời đi?',
        id: 'Kuis sedang berjalan — tetap keluar?',
    },

    'quiz.celebrate.perfect': {
        en: 'Perfect score! 🎉',
        ko: '만점이에요! 🎉',
        ja: '満点です！🎉',
        zh: '满分通过！🎉',
        es: '¡Puntuación perfecta! 🎉',
        fr: 'Score parfait ! 🎉',
        de: 'Volle Punktzahl! 🎉',
        pt: 'Pontuação perfeita! 🎉',
        ru: 'Идеально! 🎉',
        vi: 'Đạt điểm tuyệt đối! 🎉',
        id: 'Skor sempurna! 🎉',
    },
    'quiz.celebrate.great': {
        en: 'Strong run — keep it up!',
        ko: '잘하고 있어요 — 계속 가요!',
        ja: 'いい調子 — この勢いで！',
        zh: '表现很棒 — 继续保持！',
        es: 'Buen ritmo — ¡sigue así!',
        fr: 'Belle performance — continue !',
        de: 'Starker Lauf — weiter so!',
        pt: 'Ótimo desempenho — continue!',
        ru: 'Отличный результат — продолжайте!',
        vi: 'Tốt lắm — giữ phong độ nhé!',
        id: 'Lancar sekali — pertahankan!',
    },
    'quiz.celebrate.good': {
        en: 'Nice work — one more round?',
        ko: '잘하셨어요 — 한 번 더 갈래요?',
        ja: 'よくできました — もう一回どうですか？',
        zh: '不错哦 — 再来一轮？',
        es: 'Buen trabajo — ¿otra ronda?',
        fr: 'Bien joué — un autre tour ?',
        de: 'Gut gemacht — noch eine Runde?',
        pt: 'Bom trabalho — mais uma rodada?',
        ru: 'Хорошо — ещё круг?',
        vi: 'Làm tốt rồi — thêm vòng nữa nhé?',
        id: 'Kerja bagus — satu ronde lagi?',
    },

    'account.delete.label': {
        en: 'Delete account', ko: '계정 삭제', ja: 'アカウント削除', zh: '删除账户',
        es: 'Eliminar cuenta', fr: 'Supprimer le compte', de: 'Konto löschen',
        pt: 'Excluir conta', ru: 'Удалить аккаунт', vi: 'Xoá tài khoản', id: 'Hapus akun',
    },
    'account.delete.title': {
        en: 'Are you sure you want to delete your account?',
        ko: '정말 계정을 삭제하시겠어요?',
        ja: '本当にアカウントを削除しますか？',
        zh: '确定要删除账户吗？',
        es: '¿Seguro que quieres eliminar tu cuenta?',
        fr: 'Voulez-vous vraiment supprimer votre compte ?',
        de: 'Möchtest du dein Konto wirklich löschen?',
        pt: 'Tem certeza de que quer excluir sua conta?',
        ru: 'Вы уверены, что хотите удалить аккаунт?',
        vi: 'Bạn chắc chắn muốn xoá tài khoản?',
        id: 'Yakin mau menghapus akun?',
    },
    'account.delete.body': {
        en: 'This permanently removes your documents, quiz history, and profile. The action runs immediately and cannot be undone.',
        ko: '문서, 퀴즈 이력, 프로필이 즉시 영구 삭제돼요. 되돌릴 수 없어요.',
        ja: '文書・クイズ履歴・プロフィールが即座に完全削除されます。元には戻せません。',
        zh: '将立即永久删除你的文档、测验记录和资料。无法撤销。',
        es: 'Esto elimina tus documentos, historial y perfil de forma permanente. La acción es inmediata e irreversible.',
        fr: 'Cela supprime immédiatement tes documents, historiques et profil pour de bon. C\'est irréversible.',
        de: 'Damit werden Dokumente, Quizverlauf und Profil sofort dauerhaft entfernt. Die Aktion ist unumkehrbar.',
        pt: 'Isso remove permanentemente seus documentos, histórico e perfil. A ação é imediata e irreversível.',
        ru: 'Это сразу и навсегда удалит документы, историю и профиль. Отменить нельзя.',
        vi: 'Thao tác này xoá vĩnh viễn tài liệu, lịch sử và hồ sơ ngay lập tức. Không thể hoàn tác.',
        id: 'Ini menghapus dokumen, riwayat, dan profil secara permanen. Aksi langsung berlaku dan tidak bisa dibatalkan.',
    },
    'account.delete.done': {
        en: 'Your account has been deleted. Goodbye, friend. 🐒',
        ko: '계정이 삭제됐어요. 잘 지내요, 친구. 🐒',
        ja: 'アカウントを削除しました。元気でね、友よ。🐒',
        zh: '账户已删除。再见，朋友。🐒',
        es: 'Tu cuenta ha sido eliminada. Hasta siempre, amigo. 🐒',
        fr: 'Ton compte a été supprimé. Adieu, ami. 🐒',
        de: 'Dein Konto wurde gelöscht. Mach\'s gut, Freund. 🐒',
        pt: 'Sua conta foi excluída. Até mais, amigo. 🐒',
        ru: 'Аккаунт удалён. Прощай, друг. 🐒',
        vi: 'Tài khoản đã bị xoá. Tạm biệt, bạn nhé. 🐒',
        id: 'Akun Anda sudah dihapus. Sampai jumpa, sahabat. 🐒',
    },
    'account.delete.error': {
        en: "Couldn't delete your account. Please try again or contact support.",
        ko: '계정 삭제에 실패했어요. 다시 시도하거나 고객 지원에 문의해 주세요.',
        ja: 'アカウントを削除できませんでした。もう一度試すか、サポートにお問い合わせください。',
        zh: '无法删除账户。请重试或联系客服。',
        es: 'No se pudo eliminar tu cuenta. Inténtalo de nuevo o contacta a soporte.',
        fr: 'Impossible de supprimer ton compte. Réessaie ou contacte le support.',
        de: 'Konto konnte nicht gelöscht werden. Bitte erneut versuchen oder Support kontaktieren.',
        pt: 'Não foi possível excluir sua conta. Tente novamente ou contate o suporte.',
        ru: 'Не удалось удалить аккаунт. Попробуйте снова или свяжитесь с поддержкой.',
        vi: 'Không thể xoá tài khoản. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
        id: 'Tidak bisa menghapus akun. Coba lagi atau hubungi dukungan.',
    },
    'account.delete.requestSent': {
        en: 'Request received. We\'ll email you when it\'s done.',
        ko: '요청을 받았어요. 처리가 완료되면 이메일로 알려드릴게요.',
        ja: 'リクエストを受け付けました。完了したらメールでお知らせします。',
        zh: '已收到请求。完成后会发邮件通知你。',
        es: 'Solicitud recibida. Te avisaremos por email cuando termine.',
        fr: 'Demande reçue. Nous t\'enverrons un email à la fin.',
        de: 'Anfrage erhalten. Wir melden uns per E-Mail, wenn alles fertig ist.',
        pt: 'Pedido recebido. Avisaremos por email quando concluir.',
        ru: 'Запрос принят. Сообщим по email после обработки.',
        vi: 'Đã nhận yêu cầu. Mình sẽ gửi email khi hoàn tất.',
        id: 'Permintaan diterima. Kami akan kirim email kalau sudah selesai.',
    },

    'notFound.title': {
        en: 'Nothing here but bananas 🍌',
        ko: '여긴 바나나뿐이네요 🍌',
        ja: 'ここにはバナナしかありません 🍌',
        zh: '这里只有香蕉 🍌',
        es: 'Aquí solo hay plátanos 🍌',
        fr: 'Il n\'y a que des bananes ici 🍌',
        de: 'Hier gibt\'s nur Bananen 🍌',
        pt: 'Só tem bananas por aqui 🍌',
        ru: 'Тут только бананы 🍌',
        vi: 'Ở đây chỉ có chuối 🍌',
        id: 'Di sini cuma ada pisang 🍌',
    },
    'notFound.subtitle': {
        en: 'The page you\'re looking for has wandered off into the jungle.',
        ko: '찾으시는 페이지가 정글 속으로 사라졌어요.',
        ja: 'お探しのページはジャングルに消えてしまいました。',
        zh: '你想找的页面跑进丛林里了。',
        es: 'La página que buscas se perdió en la jungla.',
        fr: 'La page que vous cherchez s\'est perdue dans la jungle.',
        de: 'Die gesuchte Seite hat sich in den Dschungel verirrt.',
        pt: 'A página que você procura sumiu na selva.',
        ru: 'Страница, которую вы ищете, ушла в джунгли.',
        vi: 'Trang bạn tìm đã đi lạc vào rừng.',
        id: 'Halaman yang Anda cari menghilang ke hutan.',
    },
    'notFound.cta': {
        en: 'Take me home',
        ko: '홈으로 돌아가기',
        ja: 'ホームへ戻る',
        zh: '返回首页',
        es: 'Llévame al inicio',
        fr: 'Retour à l\'accueil',
        de: 'Zur Startseite',
        pt: 'Voltar ao início',
        ru: 'На главную',
        vi: 'Đưa mình về trang chính',
        id: 'Bawa saya pulang',
    },

    'legal.privacy': {
        en: 'Privacy Policy', ko: '개인정보 처리방침', ja: 'プライバシーポリシー', zh: '隐私政策',
        es: 'Privacidad', fr: 'Confidentialité', de: 'Datenschutz', pt: 'Privacidade',
        ru: 'Конфиденциальность', vi: 'Quyền riêng tư', id: 'Privasi',
    },
    'legal.terms': {
        en: 'Terms of Service', ko: '이용약관', ja: '利用規約', zh: '服务条款',
        es: 'Términos', fr: 'Conditions', de: 'Nutzungsbedingungen', pt: 'Termos',
        ru: 'Условия', vi: 'Điều khoản', id: 'Ketentuan',
    },

    'account.section': {
        en: 'Account & security', ko: '계정 및 보안', ja: 'アカウントとセキュリティ', zh: '账户与安全',
        es: 'Cuenta y seguridad', fr: 'Compte et sécurité', de: 'Konto & Sicherheit', pt: 'Conta e segurança',
        ru: 'Аккаунт и безопасность', vi: 'Tài khoản & bảo mật', id: 'Akun & keamanan',
    },
    'account.email.label': {
        en: 'Email', ko: '이메일', ja: 'メールアドレス', zh: '邮箱',
        es: 'Correo', fr: 'E-mail', de: 'E-Mail', pt: 'E-mail',
        ru: 'Эл. почта', vi: 'Email', id: 'Email',
    },
    'account.email.change': {
        en: 'Change email', ko: '이메일 변경', ja: 'メール変更', zh: '更改邮箱',
        es: 'Cambiar correo', fr: 'Changer l\'e-mail', de: 'E-Mail ändern', pt: 'Alterar e-mail',
        ru: 'Сменить почту', vi: 'Đổi email', id: 'Ubah email',
    },
    'account.email.new': {
        en: 'New email address', ko: '새 이메일 주소', ja: '新しいメールアドレス', zh: '新邮箱地址',
        es: 'Nuevo correo', fr: 'Nouvelle adresse e-mail', de: 'Neue E-Mail-Adresse', pt: 'Novo e-mail',
        ru: 'Новый адрес почты', vi: 'Email mới', id: 'Email baru',
    },
    'account.email.invalid': {
        en: 'Enter a valid email address.', ko: '올바른 이메일 주소를 입력해 주세요.', ja: '有効なメールアドレスを入力してください。', zh: '请输入有效的邮箱地址。',
        es: 'Introduce un correo válido.', fr: 'Saisis une adresse e-mail valide.', de: 'Gib eine gültige E-Mail-Adresse ein.', pt: 'Digite um e-mail válido.',
        ru: 'Введите корректный адрес.', vi: 'Nhập email hợp lệ.', id: 'Masukkan email yang valid.',
    },
    'account.email.sent': {
        en: 'Confirmation link sent to your new email — click it to finish.',
        ko: '새 이메일로 확인 링크를 보냈어요 — 클릭하면 변경이 완료됩니다.',
        ja: '新しいメールに確認リンクを送りました — クリックすると完了します。',
        zh: '已向新邮箱发送确认链接 — 点击即可完成更改。',
        es: 'Enviamos un enlace de confirmación a tu nuevo correo — haz clic para terminar.',
        fr: 'Lien de confirmation envoyé à ta nouvelle adresse — clique dessus pour finir.',
        de: 'Bestätigungslink an deine neue E-Mail gesendet — klicke ihn an, um abzuschließen.',
        pt: 'Enviamos um link de confirmação para o novo e-mail — clique para concluir.',
        ru: 'Ссылка для подтверждения отправлена на новую почту — нажмите её, чтобы завершить.',
        vi: 'Đã gửi liên kết xác nhận đến email mới — nhấp vào để hoàn tất.',
        id: 'Tautan konfirmasi dikirim ke email baru — klik untuk menyelesaikan.',
    },
    'account.email.error': {
        en: "Couldn't update email. Please try again.", ko: '이메일을 변경하지 못했어요. 다시 시도해 주세요.', ja: 'メールを変更できませんでした。もう一度お試しください。', zh: '无法更改邮箱，请重试。',
        es: 'No se pudo cambiar el correo. Inténtalo de nuevo.', fr: 'Impossible de changer l\'e-mail. Réessaie.', de: 'E-Mail konnte nicht geändert werden. Bitte erneut versuchen.', pt: 'Não foi possível alterar o e-mail. Tente novamente.',
        ru: 'Не удалось сменить почту. Попробуйте снова.', vi: 'Không thể đổi email. Vui lòng thử lại.', id: 'Gagal mengubah email. Coba lagi.',
    },
    'account.password.label': {
        en: 'Password', ko: '비밀번호', ja: 'パスワード', zh: '密码',
        es: 'Contraseña', fr: 'Mot de passe', de: 'Passwort', pt: 'Senha',
        ru: 'Пароль', vi: 'Mật khẩu', id: 'Kata sandi',
    },
    'account.password.change': {
        en: 'Change password', ko: '비밀번호 변경', ja: 'パスワード変更', zh: '更改密码',
        es: 'Cambiar contraseña', fr: 'Changer le mot de passe', de: 'Passwort ändern', pt: 'Alterar senha',
        ru: 'Сменить пароль', vi: 'Đổi mật khẩu', id: 'Ubah kata sandi',
    },
    'account.password.current': {
        en: 'Current password', ko: '현재 비밀번호', ja: '現在のパスワード', zh: '当前密码',
        es: 'Contraseña actual', fr: 'Mot de passe actuel', de: 'Aktuelles Passwort', pt: 'Senha atual',
        ru: 'Текущий пароль', vi: 'Mật khẩu hiện tại', id: 'Kata sandi saat ini',
    },
    'account.password.new': {
        en: 'New password', ko: '새 비밀번호', ja: '新しいパスワード', zh: '新密码',
        es: 'Nueva contraseña', fr: 'Nouveau mot de passe', de: 'Neues Passwort', pt: 'Nova senha',
        ru: 'Новый пароль', vi: 'Mật khẩu mới', id: 'Kata sandi baru',
    },
    'account.password.confirm': {
        en: 'Confirm new password', ko: '새 비밀번호 확인', ja: '新しいパスワード（確認）', zh: '确认新密码',
        es: 'Confirmar nueva contraseña', fr: 'Confirme le nouveau mot de passe', de: 'Neues Passwort bestätigen', pt: 'Confirmar nova senha',
        ru: 'Подтвердите новый пароль', vi: 'Xác nhận mật khẩu mới', id: 'Konfirmasi kata sandi baru',
    },
    'account.password.mismatch': {
        en: "New passwords don't match.", ko: '새 비밀번호가 일치하지 않아요.', ja: '新しいパスワードが一致しません。', zh: '两次输入的新密码不一致。',
        es: 'Las contraseñas no coinciden.', fr: 'Les mots de passe ne correspondent pas.', de: 'Die Passwörter stimmen nicht überein.', pt: 'As senhas não coincidem.',
        ru: 'Пароли не совпадают.', vi: 'Mật khẩu mới không khớp.', id: 'Kata sandi tidak cocok.',
    },
    'account.password.tooShort': {
        en: 'Use at least 8 characters.', ko: '8자 이상 입력해 주세요.', ja: '8文字以上で入力してください。', zh: '请至少输入 8 个字符。',
        es: 'Usa al menos 8 caracteres.', fr: 'Utilise au moins 8 caractères.', de: 'Mindestens 8 Zeichen verwenden.', pt: 'Use ao menos 8 caracteres.',
        ru: 'Минимум 8 символов.', vi: 'Dùng ít nhất 8 ký tự.', id: 'Gunakan minimal 8 karakter.',
    },
    'account.password.wrong': {
        en: 'Current password is incorrect.', ko: '현재 비밀번호가 올바르지 않아요.', ja: '現在のパスワードが正しくありません。', zh: '当前密码不正确。',
        es: 'La contraseña actual es incorrecta.', fr: 'Le mot de passe actuel est incorrect.', de: 'Aktuelles Passwort ist falsch.', pt: 'A senha atual está incorreta.',
        ru: 'Текущий пароль неверен.', vi: 'Mật khẩu hiện tại không đúng.', id: 'Kata sandi saat ini salah.',
    },
    'account.password.updated': {
        en: 'Password updated.', ko: '비밀번호가 변경됐어요.', ja: 'パスワードを変更しました。', zh: '密码已更新。',
        es: 'Contraseña actualizada.', fr: 'Mot de passe mis à jour.', de: 'Passwort aktualisiert.', pt: 'Senha atualizada.',
        ru: 'Пароль обновлён.', vi: 'Đã cập nhật mật khẩu.', id: 'Kata sandi diperbarui.',
    },
    'account.password.error': {
        en: "Couldn't update password. Please try again.", ko: '비밀번호를 변경하지 못했어요. 다시 시도해 주세요.', ja: 'パスワードを変更できませんでした。もう一度お試しください。', zh: '无法更改密码，请重试。',
        es: 'No se pudo cambiar la contraseña. Inténtalo de nuevo.', fr: 'Impossible de changer le mot de passe. Réessaie.', de: 'Passwort konnte nicht geändert werden. Bitte erneut versuchen.', pt: 'Não foi possível alterar a senha. Tente novamente.',
        ru: 'Не удалось сменить пароль. Попробуйте снова.', vi: 'Không thể đổi mật khẩu. Vui lòng thử lại.', id: 'Gagal mengubah kata sandi. Coba lagi.',
    },
    'account.google.note': {
        en: 'You sign in with Google. Manage your email and password in your Google account.',
        ko: 'Google로 로그인하고 계세요. 이메일과 비밀번호는 Google 계정에서 관리됩니다.',
        ja: 'Google でログインしています。メールとパスワードは Google アカウントで管理されます。',
        zh: '你通过 Google 登录。邮箱和密码请在 Google 账户中管理。',
        es: 'Inicias sesión con Google. Gestiona tu correo y contraseña en tu cuenta de Google.',
        fr: 'Tu te connectes avec Google. Gère ton e-mail et ton mot de passe dans ton compte Google.',
        de: 'Du meldest dich mit Google an. Verwalte E-Mail und Passwort in deinem Google-Konto.',
        pt: 'Você entra com o Google. Gerencie e-mail e senha na sua conta Google.',
        ru: 'Вы входите через Google. Управляйте почтой и паролем в аккаунте Google.',
        vi: 'Bạn đăng nhập bằng Google. Quản lý email và mật khẩu trong tài khoản Google.',
        id: 'Anda masuk dengan Google. Kelola email dan kata sandi di akun Google Anda.',
    },
    'common.save': {
        en: 'Save', ko: '저장', ja: '保存', zh: '保存',
        es: 'Guardar', fr: 'Enregistrer', de: 'Speichern', pt: 'Salvar',
        ru: 'Сохранить', vi: 'Lưu', id: 'Simpan',
    },
};

/**
 * Look up a UI string for the user's language. Falls back to English
 * when a translation is missing or the language is unsupported. The
 * profileLang argument is the raw value off `userProfile.language`
 * (`null` / `undefined` / `'auto'` → browser language).
 */
export function t(key: UiKey, profileLang?: string | null): string {
    const code = resolveContentLanguage(profileLang);
    const entry = MESSAGES[key];
    return entry[code] ?? entry.en;
}

/**
 * Whether a key has an explicit translation for a language (vs. silently
 * falling back to English). Used by the completeness test — a real
 * translation that happens to equal the English string (e.g. "Email" in
 * many languages) still counts as present.
 */
export function hasTranslation(key: UiKey, lang: string): boolean {
    return Object.prototype.hasOwnProperty.call(MESSAGES[key], lang);
}
