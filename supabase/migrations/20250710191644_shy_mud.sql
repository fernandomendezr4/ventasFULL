/*
  # Fix profile insertion policy

  1. Security Changes
    - Add policy to allow authenticated users to insert their own profile data
    - This resolves the "Database error saving new user" issue during signup

  The policy allows users to insert their own profile when auth.uid() matches the profile id.
*/

-- Add policy to allow authenticated users to insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);