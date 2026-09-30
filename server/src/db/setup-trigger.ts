import { client } from './index';

async function main() {
  console.log('Setting up auth.users trigger for automatic profile creation...');

  await client.unsafe(`
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'student'
      )
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  `);

  console.log('Trigger on_auth_user_created created successfully!');
  await client.end();
}

main().catch((err) => {
  console.error('Failed to setup trigger:', err);
  process.exit(1);
});
