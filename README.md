# AutoSepolia ETH Transfer

A secure web application for automatically transferring Sepolia ETH from multiple source wallets to destination wallets with customizable distribution options.


## Features

- **Multiple Source Wallets**: Add and manage multiple source wallets using private keys
- **Customizable Distribution**: Distribute funds using equal, percentage-based, or custom allocation
- **Multiple Destination Wallets**: Send to multiple destination wallets in a single operation
- **Real-time Balance Updates**: Monitor wallet balances in real-time
- **Secure Key Management**: Private keys are processed locally and never stored on any server
- **Dark/Light Mode**: Toggle between dark and light themes
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Blockchain**: ethers.js for Ethereum interactions
- **UI Components**: shadcn/ui, Lucide React icons
- **Styling**: Framer Motion for animations, Tailwind CSS for styling
- **Network**: Infura for Sepolia network access

## Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Infura API key (for Sepolia network access)
- Sepolia ETH in source wallets

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mrselva-eth/AutoSepolia.git
   cd AutoSepolia
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file in the root directory with the following variables:

   ```plaintext
   INFURA_PROJECT_ID=your_infura_project_id
   ```

4. Start the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

### Setting Up Source Wallets

1. Navigate to the "Setup" tab.
2. Enter your source wallet private keys (either individually or comma-separated).
3. Private keys are validated automatically.

### Setting Up Destination Wallets

1. In the "Setup" tab, add destination wallet addresses.
2. Choose between individual input or comma-separated input.
3. Addresses are validated automatically.

### Configuring Distribution

1. Navigate to the "Distribution" tab.
2. Select a distribution method:
   - **Equal Distribution**: Split funds equally between all destination wallets.
   - **Percentage-based**: Specify exact percentages for each destination wallet.
   - **Custom Distribution**: Use sliders to visually adjust the distribution.

### Transferring Funds

1. Click the "Start Transfer" button in the Distribution tab.
2. Monitor the transfer status in the "Monitor" tab.
3. Refresh wallet balances as needed.

## Deployment

This application can be deployed to Vercel with minimal configuration:

1. Push your code to GitHub.
2. Import the repository in Vercel.
3. Add your environment variables in the Vercel dashboard.
4. Deploy.

## Security Considerations

- Private keys are processed locally in the browser and are never sent to any server.
- All blockchain transactions are performed directly from your browser to the Ethereum network.
- Use this application at your own risk and only with test networks like Sepolia.
- Never use this application with real ETH or on mainnet without thorough security review.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.