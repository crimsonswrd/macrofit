import { Link } from 'react-router-dom';
import { Button } from '@/client/components/ui/Button';
import Page from '@/client/components/Page';

export default function NotFoundPage() {
  return (
    <Page seo={{ title: 'Страница не найдена', noindex: true }}>
      <div className="flex flex-col items-center justify-center py-20 text-center animate-slide-up">
        <p className="font-display text-7xl font-bold leading-none text-flame-500">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold uppercase tracking-tight">
          Страница не найдена
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-3">
          Возможно, ссылка устарела или была изменена. Вернитесь в дневник и выберите нужный раздел в навигации.
        </p>
        <Button render={<Link to="/" />} color="primary" size="lg" className="mt-6 rounded-lg px-8">
          В дневник
        </Button>
        <p className="mt-8 max-w-lg text-xs leading-relaxed text-ink-3">
          Если вы искали помощь при заболевании, лечебной диете или другой особой ситуации, автоматический расчёт FORMETRA не подходит. Обратитесь к квалифицированному специалисту.
        </p>
      </div>
    </Page>
  );
}
