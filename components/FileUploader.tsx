import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';

const CloudIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M17.5 19c0-1.7-1.3-3-3-3h-1.1c-.1-2.9-2.5-5.2-5.4-5.2-1.9 0-3.6 1-4.6 2.5-1.4-.4-2.9.2-3.7 1.4-.8 1.1-.7 2.6.2 3.5.9.9 2.1 1.4 3.4 1.4h11.2c1.7 0 3-1.3 3-3z" />
    </svg>
);

const UploadCloudIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
        <path d="M12 12v9" />
        <path d="m16 16-4-4-4 4" />
    </svg>
);

const FileIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

const XIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
    </svg>
);

interface StorageFile {
    name: string;
    id: string;
    updated_at: string;
    created_at: string;
    last_accessed_at: string;
    metadata: Record<string, any>;
}

export const FileUploader: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [files, setFiles] = useState<StorageFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const log = (message: string, details?: Record<string, unknown>) => {
        if (details) {
            console.info(`[FileUploader] ${message}`, details);
        } else {
            console.info(`[FileUploader] ${message}`);
        }
    };

    const logError = (message: string, details?: Record<string, unknown>) => {
        if (details) {
            console.error(`[FileUploader] ${message}`, details);
        } else {
            console.error(`[FileUploader] ${message}`);
        }
    };

    useEffect(() => {
        const checkUser = async () => {
            log('사용자 조회 시작');
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) {
                logError('사용자 조회 실패', { message: error.message, name: error.name });
            }
            setUser(user);
            log('사용자 조회 결과', { hasUser: Boolean(user), userId: user?.id });
            if (user) fetchFiles(user.id);
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            log('인증 상태 변경', { hasUser: Boolean(currentUser), userId: currentUser?.id });
            if (currentUser) {
                fetchFiles(currentUser.id);
            } else {
                setFiles([]);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchFiles = async (userId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            log('파일 목록 조회 시작', { bucket: 'docs', prefix: `${userId}/` });
            const { data, error } = await supabase.storage
                .from('docs')
                .list(`${userId}/`, {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'name', order: 'asc' },
                });

            if (error) {
                logError('파일 목록 조회 실패', { message: error.message, name: error.name, status: error.status });
                throw error;
            }
            log('파일 목록 조회 성공', { count: data?.length ?? 0 });
            setFiles(data?.filter(f => f.name !== '.emptyFolderPlaceholder') || []);
        } catch (err: any) {
            console.error('Error fetching files:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        if (file.type !== 'application/pdf') {
            setError('Only PDF files are allowed');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const filePath = `${user.id}/${file.name}`;
            log('업로드 시작', {
                bucket: 'docs',
                path: filePath,
                name: file.name,
                size: file.size,
                type: file.type,
                userId: user.id,
            });
            const { error: uploadError } = await supabase.storage
                .from('docs')
                .upload(filePath, file, {
                    upsert: true
                });

            if (uploadError) {
                logError('업로드 실패', { message: uploadError.message, name: uploadError.name, status: uploadError.status });
                throw uploadError;
            }

            log('업로드 완료', { path: filePath });

            await fetchFiles(user.id);
            setIsOpen(true);
        } catch (err: any) {
            console.error('Error uploading file:', err);
            setError(err.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileClick = async (file: StorageFile) => {
        if (!user) return;
        try {
            log('파일 열기 시작', { name: file.name, path: `${user.id}/${file.name}` });
            const { data, error } = await supabase.storage
                .from('docs')
                .createSignedUrl(`${user.id}/${file.name}`, 3600);

            if (error) {
                logError('서명 URL 생성 실패', { message: error.message, name: error.name, status: error.status });
                throw error;
            }
            if (data?.signedUrl) {
                log('서명 URL 생성 성공');
                window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (err: any) {
            console.error('Error opening file:', err);
            setError('Failed to open file');
        }
    };

    if (!user) return null;

    return (
        <>
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
                        flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300
                        ${isOpen ? 'bg-slate-800 text-white rotate-90' : 'bg-white text-slate-700 hover:bg-slate-50 hover:scale-110'}
                    `}
                    title="Cloud Files"
                >
                    {isOpen ? <XIcon className="w-6 h-6" /> : <CloudIcon className="w-6 h-6" />}
                </button>
            </div>

            <div
                className={`
                    fixed bottom-24 right-6 w-80 sm:w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 z-40
                    transform transition-all duration-300 origin-bottom-right flex flex-col overflow-hidden
                    ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}
                `}
                style={{ maxHeight: 'calc(100vh - 120px)' }}
            >
                <div className="p-4 border-b border-slate-100 bg-white/50 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <CloudIcon className="w-5 h-5 text-blue-500" />
                        <h3 className="font-bold text-slate-800">Cloud Files</h3>
                    </div>
                    <button 
                        onClick={() => fetchFiles(user.id)} 
                        disabled={isLoading}
                        className={`p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors ${isLoading ? 'animate-spin' : ''}`}
                    >
                        <RefreshIcon className="w-4 h-4" />
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 p-3 px-4 text-xs text-red-600 border-b border-red-100 flex items-start gap-2">
                        <span className="font-bold">Error:</span> {error}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
                    {isLoading && files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin mb-2" />
                            <span className="text-sm">Loading files...</span>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 p-4 text-center">
                            <UploadCloudIcon className="w-10 h-10 mb-2 opacity-50" />
                            <p className="text-sm font-medium">No files in the cloud</p>
                            <p className="text-xs opacity-70 mt-1">Upload a PDF to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {files.map((file) => (
                                <button
                                    key={file.id}
                                    onClick={() => handleFileClick(file)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group border border-transparent hover:border-slate-100"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 text-red-500">
                                        <FileIcon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-700 truncate">{file.name}</p>
                                        <p className="text-[10px] text-slate-400">
                                            {(file.metadata?.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleUpload}
                        ref={fileInputRef}
                        className="hidden"
                        id="cloud-upload-input"
                    />
                    <label
                        htmlFor="cloud-upload-input"
                        className={`
                            flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl 
                            font-semibold text-sm transition-all cursor-pointer shadow-sm
                            ${isUploading 
                                ? 'bg-slate-100 text-slate-400 cursor-wait' 
                                : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md active:scale-95'
                            }
                        `}
                    >
                        {isUploading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                                <span>Uploading...</span>
                            </>
                        ) : (
                            <>
                                <UploadCloudIcon className="w-4 h-4" />
                                <span>Upload PDF</span>
                            </>
                        )}
                    </label>
                </div>
            </div>
        </>
    );
};
