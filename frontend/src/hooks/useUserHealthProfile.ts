import { useState, useEffect } from 'react';

// User health profile interface
export interface UserHealthProfile {
  age?: number;
  gender?: string;
  height?: number; // in cm
  weight?: number; // in kg
  preExistingConditions?: string[];
  alcohol?: string; // none, occasional, moderate, heavy
  smoking?: string; // none, occasional, regular, heavy
  drugUse?: boolean;
  exerciseLevel?: string; // none, light, moderate, intense
  exerciseFrequency?: number; // times per week
  sleepHours?: number;
  stressLevel?: string; // low, moderate, high
  dietType?: string; // omnivore, vegetarian, vegan, other
}

// API base URL
const API_BASE_URL = 'http://localhost:3000';

/**
 * Hook to manage user health profile data
 * @param userId The ID of the current user
 * @returns An object containing health profile data and functions to manage it
 */
export const useUserHealthProfile = (userId: string | null) => {
  const [profileData, setProfileData] = useState<UserHealthProfile | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load profile data from server on mount or when userId changes
  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setProfileData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      try {
        // Fetch profile from the backend
        const response = await fetch(`${API_BASE_URL}/user-health-profile/${userId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch health profile');
        }
        
        const data = await response.json();
        
        if (data.profileExists && data.profileData) {
          setProfileData(data.profileData);
          setShowProfileForm(false);
        } else {
          // No existing profile, should show form
          setProfileData(null);
          setShowProfileForm(true);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setProfileData(null);
        setShowProfileForm(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  // Save profile data to server
  const saveProfile = async (data: UserHealthProfile) => {
    if (!userId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/user-health-profile/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save health profile');
      }
      
      setProfileData(data);
      setShowProfileForm(false);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  // Update profile with new data (partial update)
  const updateProfile = async (updates: Partial<UserHealthProfile>) => {
    if (!userId || !profileData) return;
    
    const updatedProfile = { ...profileData, ...updates };
    await saveProfile(updatedProfile);
  };

  // Format profile data for LLM context
  const getProfileForLLM = (): string => {
    if (!profileData) return '';
    
    // Convert profile data to a structured format for the LLM
    const sections = [
      `Age: ${profileData.age || 'Not specified'}`,
      `Gender: ${profileData.gender || 'Not specified'}`,
      `Height: ${profileData.height ? `${profileData.height} cm` : 'Not specified'}`,
      `Weight: ${profileData.weight ? `${profileData.weight} kg` : 'Not specified'}`,
      `Pre-existing Conditions: ${profileData.preExistingConditions?.length 
        ? profileData.preExistingConditions.join(', ') 
        : 'None reported'
      }`,
      `Alcohol Consumption: ${profileData.alcohol || 'Not specified'}`,
      `Smoking: ${profileData.smoking || 'Not specified'}`,
      `Recreational Drug Use: ${profileData.drugUse ? 'Yes' : 'No'}`,
      `Exercise Level: ${profileData.exerciseLevel || 'Not specified'}`,
      `Exercise Frequency: ${profileData.exerciseFrequency 
        ? `${profileData.exerciseFrequency} times per week` 
        : 'Not specified'
      }`,
      `Sleep: ${profileData.sleepHours 
        ? `${profileData.sleepHours} hours per night` 
        : 'Not specified'
      }`,
      `Stress Level: ${profileData.stressLevel || 'Not specified'}`,
      `Diet Type: ${profileData.dietType || 'Not specified'}`
    ];
    
    return sections.join('\n');
  };

  return {
    profileData,
    isLoading,
    showProfileForm,
    setShowProfileForm,
    saveProfile,
    updateProfile,
    getProfileForLLM
  };
};

export default useUserHealthProfile;