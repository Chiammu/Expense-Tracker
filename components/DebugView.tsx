import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export const DebugView: React.FC = () => {
    const [info, setInfo] = useState<any>({});
    const [bucketFiles, setBucketFiles] = useState<any[]>([]);
    const [dbData, setDbData] = useState<any>(null);
    const [errors, setErrors] = useState<string[]>([]);

    useEffect(() => {
        runDiagnostics();
    }, []);

    const runDiagnostics = async () => {
        const diags: any = {};
        const errs: string[] = [];

        // 1. Auth Check
        const { data: { session } } = await supabase.auth.getSession();
        diags.session = session ? "Active" : "None";
        diags.user = session?.user || null;
        setInfo(diags);

        if (!session?.user) {
            errs.push("No active session. Please log in.");
            setErrors(errs);
            return;
        }

        // 2. DB Check (app_state)
        try {
            const { data, error } = await supabase
                .from('app_state')
                .select('*')
                .eq('user_id', session.user.id);

            if (error) throw error;
            setDbData(data);
        } catch (e: any) {
            errs.push("DB Error (app_state): " + e.message);
        }

        // 3. Storage Check (Check buckets)
        try {
            // List all buckets to see if we can even access Storage
            const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
            if (bucketError) {
                // RLS might block listing buckets, try specific common names
                errs.push("List Buckets Error: " + bucketError.message);
            } else {
                diags.buckets = buckets;
            }

            // Try listing a user folder in a hypothetical 'public' or 'images' bucket
            // Common bucket names: 'images', 'uploads', 'avatars', 'public'
            const targetBucket = 'images';
            const path = `cover_photos/${session.user.id}`;

            const { data: files, error: fileError } = await supabase
                .storage
                .from(targetBucket)
                .list(path);

            if (fileError) {
                errs.push(`Storage Error (${targetBucket}): ` + fileError.message);
            } else {
                setBucketFiles(files || []);
            }

        } catch (e: any) {
            errs.push("Storage Exception: " + e.message);
        }

        setErrors(errs);
        setInfo(prev => ({ ...prev, ...diags }));
    };

    return (
        <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-xs font-mono">
            <h1 className="text-xl font-bold mb-4">🕵️‍♀️ Supabase Diagnostics</h1>

            <div className="grid gap-4">
                <section className="bg-white p-4 rounded shadow">
                    <h2 className="font-bold text-blue-600 mb-2">AUTH SESSION</h2>
                    <pre className="overflow-auto max-h-40">{JSON.stringify(info.user, null, 2)}</pre>
                </section>

                <section className="bg-white p-4 rounded shadow">
                    <h2 className="font-bold text-green-600 mb-2">POSTGRES DATA (app_state)</h2>
                    {dbData ? (
                        <div>
                            <p>Rows found: {dbData.length}</p>
                            <pre className="overflow-auto max-h-40">{JSON.stringify(dbData, null, 2)}</pre>
                        </div>
                    ) : (
                        <p className="text-gray-400">Loading or Empty...</p>
                    )}
                </section>

                <section className="bg-white p-4 rounded shadow">
                    <h2 className="font-bold text-purple-600 mb-2">STORAGE BUCKETS</h2>
                    {errors.filter(e => e.includes("Storage")).map(e => (
                        <div key={e} className="text-red-500 mb-1">{e}</div>
                    ))}
                    <p>Files found in 'images/cover_photos': {bucketFiles.length}</p>
                    <pre>{JSON.stringify(bucketFiles, null, 2)}</pre>
                </section>

                {errors.length > 0 && (
                    <section className="bg-red-50 p-4 rounded border border-red-200">
                        <h2 className="font-bold text-red-600 mb-2">ERRORS</h2>
                        {errors.map((e, i) => <div key={i}>{e}</div>)}
                    </section>
                )}
            </div>

            <button onClick={runDiagnostics} className="mt-6 px-4 py-2 bg-black text-white rounded">Re-Run Diagnostics</button>
            <button onClick={() => window.history.back()} className="ml-4 text-blue-500 underline">Back</button>
        </div>
    );
};
