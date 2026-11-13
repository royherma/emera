import { Redirect, useLocalSearchParams } from 'expo-router';

export default function InviteLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/sign-in', params: { invite: code ?? '' } }} />;
}
