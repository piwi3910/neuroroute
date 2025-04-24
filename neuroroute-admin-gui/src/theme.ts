import { createTheme, MantineColorsTuple } from '@mantine/core';

// Custom primary color with shades
const primary: MantineColorsTuple = [
  '#E3F2FD', // 0
  '#BBDEFB', // 1
  '#90CAF9', // 2
  '#64B5F6', // 3
  '#42A5F5', // 4
  '#2196F3', // 5 - Primary
  '#1E88E5', // 6
  '#1976D2', // 7
  '#1565C0', // 8
  '#0D47A1'  // 9
];

// Custom secondary color with shades
const secondary: MantineColorsTuple = [
  '#E8F5E9', // 0
  '#C8E6C9', // 1
  '#A5D6A7', // 2
  '#81C784', // 3
  '#66BB6A', // 4
  '#4CAF50', // 5 - Primary
  '#43A047', // 6
  '#388E3C', // 7
  '#2E7D32', // 8
  '#1B5E20'  // 9
];

// Custom accent color with shades
const accent: MantineColorsTuple = [
  '#FFF8E1', // 0
  '#FFECB3', // 1
  '#FFE082', // 2
  '#FFD54F', // 3
  '#FFCA28', // 4
  '#FFC107', // 5 - Primary
  '#FFB300', // 6
  '#FFA000', // 7
  '#FF8F00', // 8
  '#FF6F00'  // 9
];

// Create the theme
export const theme = createTheme({
  // Set primary colors
  colors: {
    primary,
    secondary,
    accent,
  },
  
  // Set default radius for components
  radius: {
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '16px',
    xl: '32px',
  },
  
  // Customize shadows for more depth
  shadows: {
    xs: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
    sm: '0 1px 5px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 4px 10px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 20px rgba(0, 0, 0, 0.05), 0 3px 6px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.05), 0 10px 10px rgba(0, 0, 0, 0.04)',
  },
  
  // Customize component styles
  components: {
    Paper: {
      defaultProps: {
        shadow: 'md',
        withBorder: true,
        p: 'lg',
      },
      styles: {
        root: {
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 10px 20px rgba(0, 0, 0, 0.08), 0 6px 6px rgba(0, 0, 0, 0.12)',
          },
        },
      },
    },
    Card: {
      defaultProps: {
        shadow: 'md',
        withBorder: true,
        p: 'lg',
      },
      styles: {
        root: {
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 10px 20px rgba(0, 0, 0, 0.08), 0 6px 6px rgba(0, 0, 0, 0.12)',
          },
        },
      },
    },
    Title: {
      styles: {
        root: {
          fontWeight: 600,
          '&[data-order="1"]': { fontSize: '2.2rem' },
          '&[data-order="2"]': { fontSize: '1.8rem' },
          '&[data-order="3"]': { fontSize: '1.5rem' },
          '&[data-order="4"]': { fontSize: '1.2rem' },
        },
      },
    },
  },
  
  // Other theme properties
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  fontFamilyMonospace: 'Monaco, Courier, monospace',
  headings: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: 600,
  },
  
  // Default color scheme
  primaryColor: 'primary',
  primaryShade: 5,
});