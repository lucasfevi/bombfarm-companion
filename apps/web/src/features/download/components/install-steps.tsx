import { sub, type Strings } from '@/shared/i18n';
import { REPO_URL } from '../model/release';
import { InstallStep } from './install-step';
import { InstallFileTile } from './install-file-tile';
import { PermissionDemo } from './permission-demo';
import { SmartScreenDialog } from './smart-screen-dialog';
import { WarningReason } from './warning-reason';

export function InstallSteps({ t, fileName }: { t: Strings; fileName: string | null }) {
  return (
    <section>
      <p className="m-0 mb-4 flex items-center gap-3 font-mono text-[10.5px] tracking-[0.17em] text-muted uppercase after:h-px after:flex-1 after:bg-line/60 after:content-['']">
        {t.downloadInstallHeading}
      </p>
      <ol className="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-3">
        <InstallStep
          index={1}
          title={t.downloadStepRunTitle}
          body={sub(t.downloadStepRunBody, { file: fileName ?? t.downloadInstallerGenericName })}
        >
          <InstallFileTile t={t} fileName={fileName} />
        </InstallStep>
        <InstallStep index={2} title={t.downloadStepWarnTitle} body={t.downloadStepWarnBody}>
          <SmartScreenDialog t={t} fileName={fileName} />
        </InstallStep>
        <InstallStep
          index={3}
          title={t.downloadStepPermissionTitle}
          body={t.downloadStepPermissionBody}
        >
          <p className="m-0 mt-2 text-sm leading-relaxed text-ink">
            {t.downloadStepPermissionRequirement}
          </p>
          <PermissionDemo t={t} />
        </InstallStep>
      </ol>

      <div className="mt-8">
        <p className="m-0 mb-4 flex items-center gap-3 font-mono text-[10.5px] tracking-[0.17em] text-muted uppercase after:h-px after:flex-1 after:bg-line/60 after:content-['']">
          {t.downloadWhyHeading}
        </p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <WarningReason title={t.downloadWhySmartScreenTitle}>
            {t.downloadWhySmartScreenBody}
          </WarningReason>
          <WarningReason title={t.downloadWhyAntivirusTitle}>
            {t.downloadWhyAntivirusBody}{' '}
            <a
              className="text-accent underline-offset-2 hover:underline"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              {t.downloadWhySourceLink}
            </a>
          </WarningReason>
        </div>
      </div>
    </section>
  );
}
