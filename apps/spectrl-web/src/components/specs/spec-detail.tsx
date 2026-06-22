'use client';

import { useState } from 'react';
import { ArrowLeft, Download, Calendar, User, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/copy-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SpecMarkdown } from '@/components/specs/spec-markdown';
import type { GetSpecResponse, SpecVersion } from '@/lib/schemas';
import { env } from '@/lib/env';

interface SpecDetailProps {
  spec: GetSpecResponse;
  currentVersion: SpecVersion;
  initialFileContent: string;
}

export function SpecDetail({ spec, currentVersion, initialFileContent }: SpecDetailProps) {
  const router = useRouter();

  const handleVersionChange = (version: string) => {
    const params = new URLSearchParams();
    params.set('v', version);
    router.push(`/specs/${spec.username}/${spec.specName}?${params.toString()}`);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const installCmd = `npx spectrl install ${spec.username}/${spec.specName}@${currentVersion.version}`;

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/specs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to specs
      </Link>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-semibold text-foreground md:text-2xl">
                {spec.username}/{spec.specName}
              </h1>
              <Badge
                variant={currentVersion.type === 'power' ? 'default' : 'outline'}
                className="font-mono text-xs"
              >
                {currentVersion.type}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentVersion.description}
            </p>
          </div>
          <Select value={currentVersion.version} onValueChange={handleVersionChange}>
            <SelectTrigger className="w-fit shrink-0 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {spec.versions.map((v) => (
                <SelectItem key={v.version} value={v.version} className="font-mono text-xs">
                  v{v.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3" />
            {spec.username}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3" />
            {formatDate(currentVersion.publishedAt)}
          </span>
          {currentVersion.downloads != null && (
            <span className="inline-flex items-center gap-1.5">
              <Download className="size-3" />
              {currentVersion.downloads.toLocaleString()} installs
            </span>
          )}
        </div>

        {currentVersion.tags && currentVersion.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {currentVersion.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-mono text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between rounded-md border bg-card px-4 py-3 font-mono text-sm">
          <span className="text-muted-foreground truncate">
            <span className="text-accent mr-1.5 select-none">{'$'}</span>
            {installCmd}
          </span>
          <CopyButton value={installCmd} />
        </div>

        {currentVersion.deps && Object.keys(currentVersion.deps).length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-foreground">Dependencies</h2>
            <ul className="flex flex-col gap-1">
              {Object.entries(currentVersion.deps).map(([depName, depVersion]) => (
                <li key={depName} className="font-mono text-sm text-muted-foreground">
                  <Link
                    href={`/specs?q=${encodeURIComponent(depName)}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {depName}
                  </Link>
                  <span className="ml-1 text-xs">@{depVersion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* key resets internal state when version changes */}
      <FileViewer
        key={currentVersion.version}
        files={[...new Set(currentVersion.files)]}
        s3Path={currentVersion.s3Path}
        initialFileContent={initialFileContent}
      />
    </div>
  );
}

function FileViewer({
  files,
  s3Path,
  initialFileContent,
}: {
  files: string[];
  s3Path: string;
  initialFileContent: string;
}) {
  const [selectedFile, setSelectedFile] = useState(files[0] ?? '');
  const [fileContent, setFileContent] = useState(initialFileContent);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileSelect = async (filename: string) => {
    setSelectedFile(filename);

    if (filename === files[0]) {
      setFileContent(initialFileContent);
      setFileError(null);
      return;
    }

    setIsLoadingFile(true);
    setFileError(null);

    try {
      const url = `${env.NEXT_PUBLIC_CDN_URL}/${s3Path}/files/${filename}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const content = await response.text();
      setFileContent(content);
    } catch {
      setFileError(`Failed to load ${filename}`);
      setFileContent('');
    } finally {
      setIsLoadingFile(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      {files.length > 1 && (
        <div className="flex overflow-x-auto border-b bg-card">
          {files.map((file) => (
            <button
              key={file}
              type="button"
              onClick={() => handleFileSelect(file)}
              className={`shrink-0 border-b-2 px-4 py-2.5 font-mono text-xs transition-colors ${
                selectedFile === file
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {file}
            </button>
          ))}
        </div>
      )}
      <div className="bg-background p-6 md:p-8">
        {isLoadingFile ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : fileError ? (
          <p className="text-sm text-destructive">{fileError}</p>
        ) : fileContent ? (
          <SpecMarkdown content={fileContent} />
        ) : (
          <p className="text-sm text-muted-foreground">No file selected.</p>
        )}
      </div>
    </div>
  );
}
