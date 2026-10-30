import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ResultBadge } from '@/components/ui/result-badge';
import { SheetLayout } from '@/layouts/sheet-layout';
import { cardsApi } from '@/store/api/cards-api';
import { useAppDispatch } from '@/store/hooks';
import { sessionEnded } from '@/store/slices/session-slice';

export function SessionSignOutDrawer() {
  const { t } = useTranslation(['drawers', 'common']);
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const signOut = () => {
    navigation.reset({ index: 0, routes: [{ name: '(screens)/welcome' }] });
    dispatch(sessionEnded());
    dispatch(cardsApi.util.resetApiState());
  };

  return (
    <SheetLayout
      badge={<ResultBadge icon="logout" tone="brass" round />}
      eyebrow={t('session.signOut.eyebrow')}
      title={t('session.signOut.title')}
      body={t('session.signOut.body')}
    >
      <Button label={t('session.signOut.confirm')} onPress={signOut} />
      <Button variant="secondary" label={t('common:actions.cancel')} onPress={() => navigation.goBack()} />
    </SheetLayout>
  );
}
