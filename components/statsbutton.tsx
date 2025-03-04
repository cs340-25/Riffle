import { StyleSheet, View, Text, Image, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function StatsButton() {
    return (
        <View style={styles.container}>
            <Link href="/statsScreen">
                <Pressable>
                    <Image
                        source={require("../assets/images/statsbutton.png")}
                        style={styles.image}
                    />
                </Pressable>
            </Link>
        </View >
    )
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        alignItems: 'center',
        width: 150,
        height: 150
    },
    image: {
        width: 150,
        height: 150
    }
})