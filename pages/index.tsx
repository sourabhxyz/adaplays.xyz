import {
  Box,
  Text,
  Heading,
  List,
  ListItem,
  ListIcon,
} from '@chakra-ui/react'
import type { NextPage } from 'next'
import NextLink from 'next/link'
import { brandTextBorder } from 'theme/simple'
import { AiOutlineRight } from 'react-icons/ai'

const Home: NextPage = () => {

  interface gameType {
    name: string,
    href: string,
  }
  const games: gameType[] = [
    {
      name: "Rock Paper Scissors",
      href: "/games/rps"
    }
  ]

  return (
    <>
      <Heading variant='brandUnderline' mt='30px'>
        {"⚠ Caution"}
      </Heading>
      <Text mt='10px'>
        {"Their is no guarantee that the Dapp and the associated smart contracts are free from any security vulnerabilities. The entire code base is open source and any scrutiny is appreciated."}
      </Text>
      <Heading variant='brandUnderline' mt='30px'>
        {"🛈 Note"}
      </Heading>
      <Text mt='10px'>
        {"A. Currently the Dapp is on Cardano's 'preprod' network. Kindly make sure that when interacting with Dapp functionality, you are on that network. Use 'mainnet' network to test NuFi On/Off Ramp and Dex integration."}
      </Text>
      <Text mt='10px'>
        {"B. Use HTTPS and for best experience, try to have your system clock close to actual."}
      </Text>
      <Box mt='30px' {...brandTextBorder} display='inline-block'>
        <Heading variant='brand' w='20px' h='28px' transform='rotate(-45deg)' display='inline-block'>
          {"🁌"}
        </Heading>
        <Heading variant='brand' display='inline' pl='4px'>
          {" Games"}
        </Heading>
      </Box>
      <List mt='10px'>
        {games.map((elem, ix) => {
          return (
            <ListItem key={ix} _hover={{ color: 'gray.600' }} >
              <ListIcon as={AiOutlineRight} />
              <NextLink href={elem.href} passHref>
                {elem.name}
              </NextLink>
            </ListItem>
          )
        })}
      </List>
    </>

  )
}

export default Home
